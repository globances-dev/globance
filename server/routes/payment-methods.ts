import { Router, Request, Response } from "express";
import { z } from "zod";
import { getPostgresPool } from "../utils/postgres";
import { verifyToken } from "../utils/jwt";

const router = Router();

// Auth middleware
const authMiddleware = async (req: any, res: Response, next: Function) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.user = decoded;
  next();
};

// Get user's payment methods
router.get("/", authMiddleware, async (req: any, res: Response) => {
  try {
    const { fiat_currency_code } = req.query;
    const pool = getPostgresPool();

    let query = "SELECT * FROM user_payment_methods WHERE user_id = $1";
    const params = [req.user.id];

    if (fiat_currency_code) {
      query += " AND fiat_currency_code = $2";
      params.push(fiat_currency_code);
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);

    res.json({ payment_methods: result.rows || [] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get specific payment method
router.get("/:id", authMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getPostgresPool();
    const result = await pool.query(
      "SELECT * FROM user_payment_methods WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    res.json({ payment_method: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Add payment method
router.post("/", authMiddleware, async (req: any, res: Response) => {
  try {
    const {
      fiat_currency_code,
      provider,
      account_name,
      account_number,
      extra_info,
    } = z
      .object({
        fiat_currency_code: z.string().min(2).max(10),
        provider: z.string().min(2),
        account_name: z.string().min(2),
        account_number: z.string().min(2),
        extra_info: z.record(z.any()).optional().default({}),
      })
      .parse(req.body);

    const pool = getPostgresPool();

    // Verify fiat currency exists
    const currencyResult = await pool.query(
      "SELECT code FROM fiat_currencies WHERE code = $1 AND is_active = true",
      [fiat_currency_code.toUpperCase()]
    );

    if (!currencyResult.rows || currencyResult.rows.length === 0) {
      return res.status(400).json({
        error: `Invalid or inactive currency: ${fiat_currency_code}`,
      });
    }

    const methodResult = await pool.query(
      `INSERT INTO user_payment_methods (user_id, fiat_currency_code, provider, account_holder_name, account_details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, fiat_currency_code.toUpperCase(), provider, account_name, JSON.stringify({ account_number, ...extra_info })]
    );

    if (!methodResult.rows || methodResult.rows.length === 0) {
      return res.status(400).json({ error: "Failed to create payment method" });
    }

    res.json({ success: true, payment_method: methodResult.rows[0] });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(400).json({ error: error.message });
  }
});

// Update payment method
router.put("/:id", authMiddleware, async (req: any, res: Response) => {
  try {
    const {
      provider,
      account_name,
      account_number,
      extra_info,
    } = z
      .object({
        provider: z.string().min(2).optional(),
        account_name: z.string().min(2).optional(),
        account_number: z.string().min(2).optional(),
        extra_info: z.record(z.any()).optional(),
      })
      .parse(req.body);

    const pool = getPostgresPool();
    const updates: any = {};
    if (provider !== undefined) updates.provider = provider;
    if (account_name !== undefined) updates.account_holder_name = account_name;
    if (account_number !== undefined || extra_info !== undefined) {
      const details: any = {};
      if (account_number) details.account_number = account_number;
      if (extra_info) Object.assign(details, extra_info);
      updates.account_details = JSON.stringify(details);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No updates provided" });
    }

    const setClauses = Object.keys(updates)
      .map((key, i) => `${key} = $${i + 1}`)
      .join(", ");

    const updateResult = await pool.query(
      `UPDATE user_payment_methods SET ${setClauses} WHERE id = $${Object.keys(updates).length + 1} AND user_id = $${Object.keys(updates).length + 2} RETURNING *`,
      [...Object.values(updates), req.params.id, req.user.id]
    );

    if (!updateResult.rows || updateResult.rows.length === 0) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    res.json({ success: true, payment_method: updateResult.rows[0] });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(400).json({ error: error.message });
  }
});

// Delete payment method
router.delete("/:id", authMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getPostgresPool();
    const result = await pool.query(
      "DELETE FROM user_payment_methods WHERE id = $1 AND user_id = $2 RETURNING *",
      [req.params.id, req.user.id]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
