import { Router, Request, Response } from "express";
import { z } from "zod";
import { getSupabasePool } from "../utils/supabase";
import { verifyToken } from "../utils/jwt";
import { rateLimit } from "../utils/rate-limit";
import { createP2PNotification, sendP2PEmails } from "../utils/p2p-notifications";

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
    const pool = getSupabasePool();
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
    console.error("[P2P Trades] Middleware error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
};

// Get user's trades (as buyer or seller)
router.get("/my-trades", authMiddleware, async (req: any, res: Response) => {
  try {
    const { status } = req.query;
    const pool = getSupabasePool();

    let query = `
      SELECT t.*, 
             o.side as offer_type, o.price_fiat_per_usdt as offer_price,
             b.email as buyer_email, b.username as buyer_name,
             s.email as seller_email, s.username as seller_name
      FROM p2p_trades t
      JOIN p2p_offers o ON t.offer_id = o.id
      JOIN users b ON t.buyer_id = b.id
      JOIN users s ON t.seller_id = s.id
      WHERE (t.buyer_id = $1 OR t.seller_id = $1)
    `;
    const params: any[] = [req.user.id];

    if (status) {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }

    query += " ORDER BY t.created_at DESC";

    const result = await pool.query(query, params);
    res.json({ trades: result.rows || [] });
  } catch (error: any) {
    console.error("[P2P Trades] Get my trades error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Get single trade
router.get("/:id", authMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getSupabasePool();
    
    const result = await pool.query(`
      SELECT t.*, 
             o.side as offer_type, o.price_fiat_per_usdt as offer_price, o.payment_method_ids as payment_methods,
             b.email as buyer_email, b.username as buyer_name,
             s.email as seller_email, s.username as seller_name
      FROM p2p_trades t
      JOIN p2p_offers o ON t.offer_id = o.id
      JOIN users b ON t.buyer_id = b.id
      JOIN users s ON t.seller_id = s.id
      WHERE t.id = $1 AND (t.buyer_id = $2 OR t.seller_id = $2)
    `, [req.params.id, req.user.id]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Trade not found or access denied" });
    }

    res.json({ trade: result.rows[0] });
  } catch (error: any) {
    console.error("[P2P Trades] Get trade error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Take an offer (create trade with escrow)
router.post("/", authMiddleware, async (req: any, res: Response) => {
  try {
    if (!rateLimit(`trade_create_${req.user.id}`, 5, 60000)) {
      return res.status(429).json({ error: "Too many trade creation requests. Please wait." });
    }

    const { offer_id, amount_usdt, buyer_payment_method_id } = z
      .object({
        offer_id: z.string().uuid(),
        amount_usdt: z.number().positive(),
        buyer_payment_method_id: z.string().uuid(),
      })
      .parse(req.body);

    const pool = getSupabasePool();

    // Get offer
    const offerResult = await pool.query(
      "SELECT * FROM p2p_offers WHERE id = $1 AND is_active = true",
      [offer_id]
    );

    if (!offerResult.rows.length) {
      return res.status(404).json({ error: "Offer not found or inactive" });
    }

    const offer = offerResult.rows[0];

    if (offer.user_id === req.user.id) {
      return res.status(400).json({ error: "Cannot trade with yourself" });
    }

    const remainingAmount = parseFloat(offer.remaining_amount_usdt || offer.total_amount_usdt);
    if (amount_usdt > remainingAmount) {
      return res.status(400).json({
        error: `Insufficient offer amount. Only ${remainingAmount} USDT available`,
      });
    }

    const total_fiat = amount_usdt * parseFloat(offer.price_fiat_per_usdt);

    if (offer.min_limit_fiat && offer.max_limit_fiat) {
      if (total_fiat < parseFloat(offer.min_limit_fiat) || total_fiat > parseFloat(offer.max_limit_fiat)) {
        return res.status(400).json({
          error: `Order must be between ${offer.min_limit_fiat} and ${offer.max_limit_fiat} ${offer.fiat_currency_code}`,
        });
      }
    }

    const isBuyOffer = offer.side === "buy";
    const buyer_id = isBuyOffer ? offer.user_id : req.user.id;
    const seller_id = isBuyOffer ? req.user.id : offer.user_id;

    // Verify buyer payment method
    const buyerMethodResult = await pool.query(
      "SELECT * FROM user_payment_methods WHERE id = $1 AND user_id = $2 AND fiat_currency_code = $3",
      [buyer_payment_method_id, buyer_id, offer.fiat_currency_code]
    );

    if (!buyerMethodResult.rows.length) {
      return res.status(400).json({
        error: "Invalid payment method or fiat currency mismatch",
      });
    }

    // For SELL offers, check seller has enough free USDT and lock in escrow
    if (!isBuyOffer) {
      const walletResult = await pool.query(
        "SELECT usdt_balance, escrow_balance FROM wallets WHERE user_id = $1",
        [seller_id]
      );

      const wallet = walletResult.rows[0];
      const freeBalance = parseFloat(wallet?.usdt_balance || 0) - parseFloat(wallet?.escrow_balance || 0);

      if (freeBalance < amount_usdt) {
        return res.status(400).json({
          error: "Seller has insufficient free USDT balance",
        });
      }

      // Lock funds in escrow
      await pool.query(
        "UPDATE wallets SET escrow_balance = escrow_balance + $1 WHERE user_id = $2",
        [amount_usdt, seller_id]
      );
    }

    // Create trade with 30-minute payment window
    const payment_deadline = new Date();
    payment_deadline.setMinutes(payment_deadline.getMinutes() + 30);

    const tradeResult = await pool.query(`
      INSERT INTO p2p_trades (offer_id, buyer_id, seller_id, amount_usdt, price_fiat_per_usdt, 
                              total_fiat, fiat_currency_code, status, 
                              escrow_amount_usdt, payment_deadline)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)
      RETURNING *
    `, [offer_id, buyer_id, seller_id, amount_usdt, offer.price_fiat_per_usdt, 
        total_fiat, offer.fiat_currency_code, 
        isBuyOffer ? 0 : amount_usdt, payment_deadline]);

    const trade = tradeResult.rows[0];

    // Update offer remaining amount
    await pool.query(`
      UPDATE p2p_offers 
      SET remaining_amount_usdt = remaining_amount_usdt - $1,
          is_active = (remaining_amount_usdt - $1) > 0,
          updated_at = NOW()
      WHERE id = $2
    `, [amount_usdt, offer_id]);

    // Create notifications (non-blocking)
    (async () => {
      try {
        await createP2PNotification(buyer_id, 'trade_started', 'Trade Started', `You have started a P2P trade for ${amount_usdt} USDT`, { trade_id: trade.id });
        await createP2PNotification(seller_id, 'trade_started', 'New Trade', `A buyer has taken your offer for ${amount_usdt} USDT`, { trade_id: trade.id });
      } catch (err) {
        console.error('Error creating trade notifications:', err);
      }
    })();

    res.json({ success: true, trade });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("[P2P Trades] Create trade error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Mark payment as sent (buyer uploads receipt)
router.post("/:id/payment-sent", authMiddleware, async (req: any, res: Response) => {
  try {
    if (!rateLimit(`trade_payment_${req.user.id}`, 5, 60000)) {
      return res.status(429).json({ error: "Too many payment mark requests. Please wait." });
    }

    const { payment_receipt_url } = z
      .object({
        payment_receipt_url: z.string().url().optional(),
      })
      .parse(req.body);

    const pool = getSupabasePool();

    const tradeResult = await pool.query(
      "SELECT * FROM p2p_trades WHERE id = $1 AND buyer_id = $2 AND status = 'pending'",
      [req.params.id, req.user.id]
    );

    if (!tradeResult.rows.length) {
      return res.status(404).json({ error: "Trade not found or already processed" });
    }

    const trade = tradeResult.rows[0];

    if (new Date(trade.payment_deadline) < new Date()) {
      return res.status(400).json({ error: "Payment deadline has passed" });
    }

    const result = await pool.query(`
      UPDATE p2p_trades 
      SET status = 'payment_sent', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [req.params.id]);

    // Create notifications (non-blocking)
    (async () => {
      try {
        await createP2PNotification(trade.seller_id, 'payment_sent', 'Payment Marked', `Buyer marked payment as sent for ${trade.amount_usdt} USDT`, { trade_id: trade.id });
      } catch (err) {
        console.error('Error creating payment notification:', err);
      }
    })();

    res.json({ success: true, trade: result.rows[0] });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("[P2P Trades] Payment sent error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Release USDT (seller confirms payment received)
router.post("/:id/release", authMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getSupabasePool();

    const tradeResult = await pool.query(
      "SELECT * FROM p2p_trades WHERE id = $1 AND seller_id = $2 AND status = 'payment_sent'",
      [req.params.id, req.user.id]
    );

    if (!tradeResult.rows.length) {
      return res.status(404).json({
        error: "Trade not found or not ready for release",
      });
    }

    const trade = tradeResult.rows[0];

    // Release from seller escrow
    await pool.query(
      "UPDATE wallets SET escrow_balance = escrow_balance - $1 WHERE user_id = $2",
      [trade.escrow_amount_usdt, trade.seller_id]
    );

    // Add to buyer balance
    await pool.query(
      "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
      [trade.amount_usdt, trade.buyer_id]
    );

    // Update trade status
    const result = await pool.query(`
      UPDATE p2p_trades 
      SET status = 'completed', completed_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [req.params.id]);

    // Create notifications (non-blocking)
    (async () => {
      try {
        await createP2PNotification(trade.buyer_id, 'released', 'Funds Released', `Seller released ${trade.amount_usdt} USDT to your wallet`, { trade_id: trade.id });
        await createP2PNotification(trade.seller_id, 'released', 'Trade Completed', `You released ${trade.amount_usdt} USDT. Trade completed`, { trade_id: trade.id });
      } catch (err) {
        console.error('Error creating release notifications:', err);
      }
    })();

    res.json({ success: true, trade: result.rows[0] });
  } catch (error: any) {
    console.error("[P2P Trades] Release error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Cancel trade (buyer only, before payment sent)
router.post("/:id/cancel", authMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getSupabasePool();

    const tradeResult = await pool.query(
      "SELECT * FROM p2p_trades WHERE id = $1 AND buyer_id = $2 AND status = 'pending'",
      [req.params.id, req.user.id]
    );

    if (!tradeResult.rows.length) {
      return res.status(404).json({ 
        error: "Trade not found. Only buyers can cancel pending trades before marking payment as sent." 
      });
    }

    const trade = tradeResult.rows[0];

    // Release escrow back to seller
    if (parseFloat(trade.escrow_amount_usdt || 0) > 0) {
      await pool.query(
        "UPDATE wallets SET escrow_balance = escrow_balance - $1 WHERE user_id = $2",
        [trade.escrow_amount_usdt, trade.seller_id]
      );
    }

    // Return amount to offer
    await pool.query(`
      UPDATE p2p_offers 
      SET remaining_amount_usdt = remaining_amount_usdt + $1, is_active = true, updated_at = NOW()
      WHERE id = $2
    `, [trade.amount_usdt, trade.offer_id]);

    // Update trade
    const result = await pool.query(`
      UPDATE p2p_trades 
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [req.params.id]);

    // Create notifications (non-blocking)
    (async () => {
      try {
        await createP2PNotification(trade.buyer_id, 'cancelled', 'Trade Cancelled', `You cancelled the trade. Amount returned to seller`, { trade_id: trade.id });
        await createP2PNotification(trade.seller_id, 'cancelled', 'Trade Cancelled', `Buyer cancelled the trade. Escrow released back to your wallet`, { trade_id: trade.id });
      } catch (err) {
        console.error('Error creating cancel notifications:', err);
      }
    })();

    res.json({ success: true, trade: result.rows[0] });
  } catch (error: any) {
    console.error("[P2P Trades] Cancel error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Open dispute
router.post("/:id/dispute", authMiddleware, async (req: any, res: Response) => {
  try {
    if (!rateLimit(`trade_dispute_${req.user.id}`, 3, 300000)) {
      return res.status(429).json({ error: "Too many dispute requests. Please wait." });
    }

    const { dispute_reason } = z
      .object({
        dispute_reason: z.string().min(10),
      })
      .parse(req.body);

    const pool = getSupabasePool();

    const tradeResult = await pool.query(
      "SELECT * FROM p2p_trades WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2) AND status = 'payment_sent'",
      [req.params.id, req.user.id]
    );

    if (!tradeResult.rows.length) {
      return res.status(404).json({
        error: "Trade not found or cannot be disputed",
      });
    }

    const trade = tradeResult.rows[0];

    const result = await pool.query(`
      UPDATE p2p_trades 
      SET status = 'disputed', dispute_reason = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [dispute_reason, req.params.id]);

    // Create notifications (non-blocking)
    (async () => {
      try {
        await createP2PNotification(trade.buyer_id, 'dispute_opened', 'Dispute Opened', `Dispute opened on trade. Admin will review shortly`, { trade_id: trade.id });
        await createP2PNotification(trade.seller_id, 'dispute_opened', 'Dispute Opened', `Dispute opened on trade. Admin will review shortly`, { trade_id: trade.id });
      } catch (err) {
        console.error('Error creating dispute notifications:', err);
      }
    })();

    res.json({ success: true, trade: result.rows[0] });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("[P2P Trades] Dispute error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Resolve dispute (admin only)
router.post("/:id/resolve-dispute", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { resolution, notes } = z
      .object({
        resolution: z.enum(["buyer", "seller"]),
        notes: z.string().optional(),
      })
      .parse(req.body);

    const pool = getSupabasePool();

    const tradeResult = await pool.query(
      "SELECT * FROM p2p_trades WHERE id = $1 AND status = 'disputed'",
      [req.params.id]
    );

    if (!tradeResult.rows.length) {
      return res.status(404).json({ error: "Disputed trade not found" });
    }

    const trade = tradeResult.rows[0];
    const newStatus = resolution === "buyer" ? "completed" : "cancelled";

    // Handle funds based on resolution
    if (resolution === "buyer") {
      // Release to buyer
      await pool.query(
        "UPDATE wallets SET escrow_balance = escrow_balance - $1 WHERE user_id = $2",
        [trade.escrow_amount_usdt, trade.seller_id]
      );
      await pool.query(
        "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
        [trade.amount_usdt, trade.buyer_id]
      );
    } else {
      // Return to seller
      await pool.query(
        "UPDATE wallets SET escrow_balance = escrow_balance - $1, usdt_balance = usdt_balance + $1 WHERE user_id = $2",
        [trade.escrow_amount_usdt, trade.seller_id]
      );
    }

    // Update trade
    const result = await pool.query(`
      UPDATE p2p_trades 
      SET status = $1, dispute_resolved_by = $2, dispute_resolution = $3, 
          completed_at = NOW(), updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [newStatus, req.user.id, notes || `Resolved in favor of ${resolution}`, req.params.id]);

    // Audit log
    await pool.query(`
      INSERT INTO audit_logs (admin_id, action, resource_type, resource_id, details)
      VALUES ($1, $2, $3, $4, $5)
    `, [req.user.id, "p2p_dispute_resolved", "trade", trade.id, JSON.stringify({ resolution, notes })]);

    // Create notifications (non-blocking)
    (async () => {
      try {
        const beneficiary = resolution === "buyer" ? trade.buyer_id : trade.seller_id;
        const loser = resolution === "buyer" ? trade.seller_id : trade.buyer_id;
        
        await createP2PNotification(beneficiary, 'dispute_resolved', 'Dispute Resolved - You Won', `Admin resolved dispute in your favor`, { trade_id: trade.id });
        await createP2PNotification(loser, 'dispute_resolved', 'Dispute Resolved', `Admin resolved dispute. Resolution: ${resolution}`, { trade_id: trade.id });
      } catch (err) {
        console.error('Error creating dispute resolved notifications:', err);
      }
    })();

    res.json({ success: true, trade: result.rows[0] });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("[P2P Trades] Resolve dispute error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Get disputed trades (admin only)
router.get("/admin/disputes", adminMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getSupabasePool();
    
    const result = await pool.query(`
      SELECT t.*, 
             o.side as offer_type, o.price_fiat_per_usdt as offer_price,
             b.email as buyer_email, b.username as buyer_name,
             s.email as seller_email, s.username as seller_name
      FROM p2p_trades t
      JOIN p2p_offers o ON t.offer_id = o.id
      JOIN users b ON t.buyer_id = b.id
      JOIN users s ON t.seller_id = s.id
      WHERE t.status = 'disputed'
      ORDER BY t.created_at DESC
    `);

    res.json({ trades: result.rows || [] });
  } catch (error: any) {
    console.error("[P2P Trades] Get disputes error:", error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
