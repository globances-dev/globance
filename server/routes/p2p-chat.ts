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

// Get chat messages for a trade
router.get("/:trade_id", authMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getPostgresPool();

    // Verify user is participant in trade
    const tradeResult = await pool.query(
      "SELECT buyer_id, seller_id FROM trades WHERE id = $1",
      [req.params.trade_id]
    );

    if (!tradeResult.rows || tradeResult.rows.length === 0) {
      return res.status(404).json({ error: "Trade not found" });
    }

    const trade = tradeResult.rows[0];
    if (trade.buyer_id !== req.user.id && trade.seller_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const messagesResult = await pool.query(
      `SELECT m.*, u.id as sender_id, u.email, u.username FROM p2p_chat_messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.trade_id = $1
       ORDER BY m.created_at ASC`,
      [req.params.trade_id]
    );

    res.json({ messages: messagesResult.rows || [] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Send chat message
router.post("/:trade_id", authMiddleware, async (req: any, res: Response) => {
  try {
    const { message, attachment_url } = z
      .object({
        message: z.string().min(1).max(1000).optional(),
        attachment_url: z.string().url().optional(),
      })
      .refine((data) => data.message || data.attachment_url, {
        message: "Either message or attachment_url is required",
      })
      .parse(req.body);

    const pool = getPostgresPool();

    // Verify user is participant
    const tradeResult = await pool.query(
      "SELECT buyer_id, seller_id FROM trades WHERE id = $1",
      [req.params.trade_id]
    );

    if (!tradeResult.rows || tradeResult.rows.length === 0) {
      return res.status(404).json({ error: "Trade not found" });
    }

    const trade = tradeResult.rows[0];
    if (trade.buyer_id !== req.user.id && trade.seller_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Insert message
    const insertResult = await pool.query(
      `INSERT INTO p2p_chat_messages (trade_id, sender_id, message, attachment_url, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       RETURNING *`,
      [req.params.trade_id, req.user.id, message || null, attachment_url || null]
    );

    if (!insertResult.rows || insertResult.rows.length === 0) {
      return res.status(400).json({ error: "Failed to send message" });
    }

    const chatMessage = insertResult.rows[0];

    res.json({ success: true, message: chatMessage });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(400).json({ error: error.message });
  }
});

export default router;
