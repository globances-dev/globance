import { Router, Request, Response } from "express";
import { z } from "zod";
import { getSupabaseQueryClient } from "../utils/supabase";
import { verifyToken } from "../utils/jwt";

const router = Router();

// Admin middleware
const adminMiddleware = async (req: any, res: Response, next: Function) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const db = getSupabaseQueryClient();
  const result = await db.exec(
    "SELECT role FROM users WHERE id = $1",
    [decoded.id]
  );

  if (!result.rows || result.rows.length === 0 || result.rows[0].role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  req.user = decoded;
  next();
};

// Get all active fiat currencies (public)
router.get("/", async (req: Request, res: Response) => {
  try {
    const db = getSupabaseQueryClient();
    const result = await db.exec(
      "SELECT * FROM fiat_currencies WHERE is_active = true ORDER BY name"
    );

    res.json({ currencies: result.rows || [] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get all fiat currencies including inactive (admin only)
router.get("/all", adminMiddleware, async (req: any, res: Response) => {
  try {
    const db = getSupabaseQueryClient();
    const result = await db.exec(
      "SELECT * FROM fiat_currencies ORDER BY name"
    );

    res.json({ currencies: result.rows || [] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get single fiat currency
router.get("/:code", async (req: Request, res: Response) => {
  try {
    const db = getSupabaseQueryClient();
    const result = await db.exec(
      "SELECT * FROM fiat_currencies WHERE code = $1",
      [req.params.code.toUpperCase()]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: "Currency not found" });
    }

    res.json({ currency: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Create fiat currency (admin only)
router.post("/", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { code, name, min_price, max_price, is_active } = z
      .object({
        code: z.string().min(2).max(10),
        name: z.string().min(2),
        min_price: z.number().positive(),
        max_price: z.number().positive(),
        is_active: z.boolean().optional().default(true),
      })
      .parse(req.body);

    if (min_price >= max_price) {
      return res
        .status(400)
        .json({ error: "min_price must be less than max_price" });
    }

    const db = getSupabaseQueryClient();
    const result = await db.exec(
      `INSERT INTO fiat_currencies (code, name, min_price, max_price, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [code.toUpperCase(), name, min_price, max_price, is_active]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(400).json({ error: "Failed to create currency" });
    }

    const currency = result.rows[0];

    // Audit log
    await db.exec(
      `INSERT INTO audit_logs (admin_id, action, resource_type, details)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, "fiat_currency_created", "fiat_currency", JSON.stringify({ code, name })]
    );

    res.json({ success: true, currency });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(400).json({ error: error.message });
  }
});

// Update fiat currency (admin only)
router.put("/:code", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { name, min_price, max_price, is_active } = z
      .object({
        name: z.string().min(2).optional(),
        min_price: z.number().positive().optional(),
        max_price: z.number().positive().optional(),
        is_active: z.boolean().optional(),
      })
      .parse(req.body);

    const db = getSupabaseQueryClient();
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (min_price !== undefined) updates.min_price = min_price;
    if (max_price !== undefined) updates.max_price = max_price;
    if (is_active !== undefined) updates.is_active = is_active;

    // Validate min < max
    if (updates.min_price !== undefined || updates.max_price !== undefined) {
      const currResult = await db.exec(
        "SELECT min_price, max_price FROM fiat_currencies WHERE code = $1",
        [req.params.code.toUpperCase()]
      );

      if (!currResult.rows || currResult.rows.length === 0) {
        return res.status(404).json({ error: "Currency not found" });
      }

      const finalMin = updates.min_price ?? currResult.rows[0].min_price;
      const finalMax = updates.max_price ?? currResult.rows[0].max_price;

      if (finalMin >= finalMax) {
        return res
          .status(400)
          .json({ error: "min_price must be less than max_price" });
      }
    }

    const setClauses = Object.keys(updates)
      .map((key, i) => `${key} = $${i + 1}`)
      .join(", ");

    const updateResult = await db.exec(
      `UPDATE fiat_currencies SET ${setClauses} WHERE code = $${Object.keys(updates).length + 1} RETURNING *`,
      [...Object.values(updates), req.params.code.toUpperCase()]
    );

    if (!updateResult.rows || updateResult.rows.length === 0) {
      return res.status(404).json({ error: "Currency not found" });
    }

    const currency = updateResult.rows[0];

    // Audit log
    await db.exec(
      `INSERT INTO audit_logs (admin_id, action, resource_type, details)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, "fiat_currency_updated", "fiat_currency", JSON.stringify(updates)]
    );

    res.json({ success: true, currency });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(400).json({ error: error.message });
  }
});

// Delete fiat currency (admin only)
router.delete("/:code", adminMiddleware, async (req: any, res: Response) => {
  try {
    const db = getSupabaseQueryClient();
    const result = await db.exec(
      "DELETE FROM fiat_currencies WHERE code = $1 RETURNING *",
      [req.params.code.toUpperCase()]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: "Currency not found" });
    }

    const currency = result.rows[0];

    // Audit log
    await db.exec(
      `INSERT INTO audit_logs (admin_id, action, resource_type, details)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, "fiat_currency_deleted", "fiat_currency", JSON.stringify({ code: currency.code, name: currency.name })]
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
