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

  try {
    const pool = getSupabaseQueryClient();
    const result = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [decoded.id]
    );

    if (!result.rows.length || result.rows[0].role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    req.user = decoded;
    next();
  } catch (error: any) {
    console.error("[Payment Providers] Middleware error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
};

// Get all approved payment providers (public - for users creating offers)
router.get("/", async (req: Request, res: Response) => {
  try {
    const { fiat_currency_code, type } = req.query;
    const pool = getSupabaseQueryClient();

    let query = "SELECT * FROM approved_payment_providers WHERE is_active = true";
    const params: any[] = [];

    if (fiat_currency_code) {
      params.push(fiat_currency_code.toString().toUpperCase());
      query += ` AND fiat_currency = $${params.length}`;
    }

    if (type) {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }

    query += " ORDER BY type, name";

    const result = await pool.query(query, params);
    res.json({ providers: result.rows || [] });
  } catch (error: any) {
    console.error("[Payment Providers] Error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Get all approved payment providers including inactive (admin only)
router.get("/all", adminMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getSupabaseQueryClient();
    const result = await pool.query(`
      SELECT * FROM approved_payment_providers
      ORDER BY fiat_currency, type, name
    `);

    res.json({ providers: result.rows || [] });
  } catch (error: any) {
    console.error("[Payment Providers] Get all error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Create approved payment provider (admin only)
router.post("/", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { fiat_currency_code, type, provider_name, is_active } = z
      .object({
        fiat_currency_code: z.string().min(2).max(10).toUpperCase(),
        type: z.enum(["bank", "mobile_money", "wallet", "other"]),
        provider_name: z.string().min(2),
        is_active: z.boolean().optional().default(true),
      })
      .parse(req.body);

    const pool = getSupabaseQueryClient();

    // Verify fiat currency exists
    const currencyResult = await pool.query(
      "SELECT code FROM fiat_currencies WHERE code = $1",
      [fiat_currency_code]
    );

    if (!currencyResult.rows.length) {
      return res.status(400).json({
        error: `Invalid currency: ${fiat_currency_code}`,
      });
    }

    const result = await pool.query(`
      INSERT INTO approved_payment_providers (fiat_currency, type, name, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [fiat_currency_code, type, provider_name, is_active]);

    // Audit log
    await pool.query(`
      INSERT INTO audit_logs (admin_id, action, resource_type, resource_id, details)
      VALUES ($1, $2, $3, $4, $5)
    `, [req.user.id, "payment_provider_created", "payment_provider", result.rows[0].id, 
        JSON.stringify({ fiat_currency_code, type, provider_name })]);

    res.json({ success: true, provider: result.rows[0] });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.code === "23505") {
      return res.status(400).json({
        error: "This provider already exists for this currency",
      });
    }
    console.error("[Payment Providers] Create error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Update approved payment provider (admin only)
router.put("/:id", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { provider_name, is_active } = z
      .object({
        provider_name: z.string().min(2).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(req.body);

    const pool = getSupabaseQueryClient();

    const updates: string[] = [];
    const params: any[] = [];

    if (provider_name !== undefined) {
      params.push(provider_name);
      updates.push(`name = $${params.length}`);
    }
    if (is_active !== undefined) {
      params.push(is_active);
      updates.push(`is_active = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No updates provided" });
    }

    params.push(req.params.id);
    const result = await pool.query(`
      UPDATE approved_payment_providers
      SET ${updates.join(", ")}
      WHERE id = $${params.length}
      RETURNING *
    `, params);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Payment provider not found" });
    }

    // Audit log
    await pool.query(`
      INSERT INTO audit_logs (admin_id, action, resource_type, resource_id, details)
      VALUES ($1, $2, $3, $4, $5)
    `, [req.user.id, "payment_provider_updated", "payment_provider", req.params.id, 
        JSON.stringify({ provider_name, is_active })]);

    res.json({ success: true, provider: result.rows[0] });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("[Payment Providers] Update error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Delete approved payment provider (admin only)
router.delete("/:id", adminMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getSupabaseQueryClient();

    const result = await pool.query(`
      DELETE FROM approved_payment_providers
      WHERE id = $1
      RETURNING *
    `, [req.params.id]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Payment provider not found" });
    }

    // Audit log
    await pool.query(`
      INSERT INTO audit_logs (admin_id, action, resource_type, resource_id, details)
      VALUES ($1, $2, $3, $4, $5)
    `, [req.user.id, "payment_provider_deleted", "payment_provider", req.params.id, 
        JSON.stringify({ fiat_currency: result.rows[0].fiat_currency, name: result.rows[0].name })]);

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Payment Providers] Delete error:", error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
