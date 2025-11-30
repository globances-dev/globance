import { Router, Request, Response } from "express";
import { z } from "zod";
import { getSupabasePool } from "../utils/supabase";
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

// Get all active offers (with filters)
router.get("/", async (req: Request, res: Response) => {
  try {
    const { side, fiat_currency_code, country, payment_method } = req.query;
    const pool = getSupabasePool();

    let query = "SELECT o.*, u.email, u.username FROM offers o LEFT JOIN users u ON o.user_id = u.id WHERE o.is_active = true AND o.remaining_amount_usdt > 0";
    const params: any[] = [];

    if (side) {
      query += " AND o.side = $" + (params.length + 1);
      params.push(side);
    }

    if (fiat_currency_code) {
      query += " AND o.fiat_currency_code = $" + (params.length + 1);
      params.push(fiat_currency_code);
    }

    if (country) {
      query += " AND o.country ILIKE $" + (params.length + 1);
      params.push(`%${country}%`);
    }

    query += " ORDER BY o.price_fiat_per_usdt " + (side === "buy" ? "ASC" : "DESC");

    const result = await pool.query(query, params);
    const offers = result.rows || [];

    // Filter by payment method if specified
    let filteredOffers = offers;
    if (payment_method && typeof payment_method === "string") {
      const methodResult = await pool.query(
        "SELECT id FROM user_payment_methods WHERE provider_name ILIKE $1",
        [`%${payment_method}%`]
      );
      const methodIds = methodResult.rows?.map((m) => m.id) || [];
      filteredOffers = offers.filter((offer) => {
        const pmIds = offer.payment_method_ids || [];
        return pmIds.some((id: string) => methodIds.includes(id));
      });
    }

    res.json({ offers: filteredOffers });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get user's own offers
router.get("/my-offers", authMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getSupabasePool();
    const result = await pool.query(
      "SELECT * FROM offers WHERE user_id = $1 ORDER BY created_at DESC",
      [req.user.id]
    );

    res.json({ offers: result.rows || [] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get single offer
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const pool = getSupabasePool();
    const result = await pool.query(
      "SELECT o.*, u.email, u.username FROM offers o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = $1",
      [req.params.id]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: "Offer not found" });
    }

    res.json({ offer: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Create offer
router.post("/", authMiddleware, async (req: any, res: Response) => {
  try {
    const {
      side,
      total_amount_usdt,
      price_fiat_per_usdt,
      fiat_currency_code,
      country,
      min_limit_fiat,
      max_limit_fiat,
      payment_method_ids,
    } = z
      .object({
        side: z.enum(["buy", "sell"]),
        total_amount_usdt: z.number().positive(),
        price_fiat_per_usdt: z.number().positive(),
        fiat_currency_code: z.string().min(2).max(10).toUpperCase(),
        country: z.string().min(2),
        min_limit_fiat: z.number().positive(),
        max_limit_fiat: z.number().positive(),
        payment_method_ids: z.array(z.string()).min(1),
      })
      .parse(req.body);

    // Validate min < max limits
    if (min_limit_fiat >= max_limit_fiat) {
      return res
        .status(400)
        .json({ error: "min_limit_fiat must be less than max_limit_fiat" });
    }

    const pool = getSupabasePool();

    // Validate max limits are consistent with total amount
    const total_fiat = total_amount_usdt * price_fiat_per_usdt;
    if (max_limit_fiat > total_fiat) {
      return res.status(400).json({
        error: `max_limit_fiat cannot exceed total offer value (${total_fiat.toFixed(2)} ${fiat_currency_code})`,
      });
    }

    // Get fiat currency and validate price range
    const currencyResult = await pool.query(
      "SELECT * FROM fiat_currencies WHERE code = $1 AND is_active = true",
      [fiat_currency_code]
    );

    if (!currencyResult.rows || currencyResult.rows.length === 0) {
      return res.status(400).json({
        error: `Invalid or inactive currency: ${fiat_currency_code}`,
      });
    }

    const currency = currencyResult.rows[0];

    // Validate price within range
    if (
      price_fiat_per_usdt < currency.min_price ||
      price_fiat_per_usdt > currency.max_price
    ) {
      return res.status(400).json({
        error: `Price must be between ${currency.min_price} and ${currency.max_price} ${fiat_currency_code} for 1 USDT`,
      });
    }

    // Verify all payment methods belong to user
    const methodsResult = await pool.query(
      "SELECT id, fiat_currency_code FROM user_payment_methods WHERE user_id = $1 AND is_active = true",
      [req.user.id]
    );

    const userMethods = methodsResult.rows || [];
    const validMethodIds = userMethods.map((m) => m.id);

    if (!payment_method_ids.every((id) => validMethodIds.includes(id))) {
      return res.status(400).json({
        error: "Invalid payment methods or methods do not belong to you",
      });
    }

    // Verify all methods are for the same fiat currency
    const invalidMethods = userMethods.filter(
      (m) => m.fiat_currency_code !== fiat_currency_code
    );
    if (invalidMethods.length > 0) {
      return res.status(400).json({
        error: `All payment methods must be for ${fiat_currency_code}`,
      });
    }

    // For SELL offers, check user has enough free USDT
    if (side === "sell") {
      const walletResult = await pool.query(
        "SELECT usdt_balance, escrow_balance FROM wallets WHERE user_id = $1",
        [req.user.id]
      );

      if (walletResult.rows && walletResult.rows.length > 0) {
        const wallet = walletResult.rows[0];
        const freeBalance = (wallet.usdt_balance || 0) - (wallet.escrow_balance || 0);

        if (freeBalance < total_amount_usdt) {
          return res.status(400).json({
            error: `Insufficient free USDT balance. You have ${freeBalance} USDT available but offer requires ${total_amount_usdt} USDT`,
          });
        }
      }
    }

    // Create offer
    const insertResult = await pool.query(
      `INSERT INTO offers (user_id, side, total_amount_usdt, remaining_amount_usdt, price_fiat_per_usdt, fiat_currency_code, country, min_limit_fiat, max_limit_fiat, payment_method_ids, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, CURRENT_TIMESTAMP)
       RETURNING *`,
      [req.user.id, side, total_amount_usdt, total_amount_usdt, price_fiat_per_usdt, fiat_currency_code, country, min_limit_fiat, max_limit_fiat, JSON.stringify(payment_method_ids)]
    );

    if (!insertResult.rows || insertResult.rows.length === 0) {
      return res.status(400).json({ error: "Failed to create offer" });
    }

    res.json({ success: true, offer: insertResult.rows[0] });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(400).json({ error: error.message });
  }
});

// Update offer
router.put("/:id", authMiddleware, async (req: any, res: Response) => {
  try {
    const {
      price_fiat_per_usdt,
      min_limit_fiat,
      max_limit_fiat,
      payment_method_ids,
      is_active,
    } = z
      .object({
        price_fiat_per_usdt: z.number().positive().optional(),
        min_limit_fiat: z.number().positive().optional(),
        max_limit_fiat: z.number().positive().optional(),
        payment_method_ids: z.array(z.string()).min(1).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(req.body);

    const pool = getSupabasePool();

    // Get current offer
    const currentResult = await pool.query(
      "SELECT * FROM offers WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );

    if (!currentResult.rows || currentResult.rows.length === 0) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const currentOffer = currentResult.rows[0];
    const updates: any = {};

    // Validate and set price if changed
    if (price_fiat_per_usdt !== undefined) {
      const currencyResult = await pool.query(
        "SELECT min_price, max_price FROM fiat_currencies WHERE code = $1",
        [currentOffer.fiat_currency_code]
      );

      if (currencyResult.rows && currencyResult.rows.length > 0) {
        const currency = currencyResult.rows[0];
        if (
          price_fiat_per_usdt < currency.min_price ||
          price_fiat_per_usdt > currency.max_price
        ) {
          return res.status(400).json({
            error: `Price must be between ${currency.min_price} and ${currency.max_price} ${currentOffer.fiat_currency_code}`,
          });
        }
      }

      updates.price_fiat_per_usdt = price_fiat_per_usdt;
    }

    if (min_limit_fiat !== undefined) updates.min_limit_fiat = min_limit_fiat;
    if (max_limit_fiat !== undefined) updates.max_limit_fiat = max_limit_fiat;
    if (payment_method_ids !== undefined) updates.payment_method_ids = JSON.stringify(payment_method_ids);
    if (is_active !== undefined) updates.is_active = is_active;

    // Validate limits
    const finalMin = updates.min_limit_fiat ?? currentOffer.min_limit_fiat;
    const finalMax = updates.max_limit_fiat ?? currentOffer.max_limit_fiat;
    if (finalMin >= finalMax) {
      return res
        .status(400)
        .json({ error: "min_limit_fiat must be less than max_limit_fiat" });
    }

    // Build update query
    const updateCols = Object.keys(updates);
    if (updateCols.length === 0) {
      return res.json({ success: true, offer: currentOffer });
    }

    const setClause = updateCols.map((col, idx) => `${col} = $${idx + 1}`).join(", ");
    const updateResult = await pool.query(
      `UPDATE offers SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${updateCols.length + 1} RETURNING *`,
      [...Object.values(updates), req.params.id]
    );

    if (!updateResult.rows || updateResult.rows.length === 0) {
      return res.status(400).json({ error: "Failed to update offer" });
    }

    res.json({ success: true, offer: updateResult.rows[0] });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(400).json({ error: error.message });
  }
});

// Delete/cancel offer
router.delete("/:id", authMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getSupabasePool();

    // Check if offer has active trades
    const tradesResult = await pool.query(
      "SELECT id FROM trades WHERE offer_id = $1 AND status IN ('pending', 'payment_sent', 'disputed')",
      [req.params.id]
    );

    if (tradesResult.rows && tradesResult.rows.length > 0) {
      return res.status(400).json({
        error: "Cannot delete offer with active trades",
      });
    }

    const deleteResult = await pool.query(
      "UPDATE offers SET is_active = false WHERE id = $1 AND user_id = $2 RETURNING *",
      [req.params.id, req.user.id]
    );

    if (!deleteResult.rows || deleteResult.rows.length === 0) {
      return res.status(404).json({ error: "Offer not found" });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
