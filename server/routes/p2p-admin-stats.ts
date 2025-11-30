import { Router, Request, Response } from "express";
import { getSupabasePool } from "../utils/supabase";
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
    console.error("[P2P Admin Stats] Middleware error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
};

// Get marketplace-wide P2P statistics (admin only)
router.get("/", adminMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getSupabasePool();

    // Get active offers count
    const offersResult = await pool.query(
      "SELECT COUNT(*) as count FROM p2p_offers WHERE is_active = true"
    );
    const activeOffers = parseInt(offersResult.rows[0]?.count) || 0;

    // Get all trades
    const tradesResult = await pool.query(
      "SELECT id, status, amount_usdt, buyer_id, seller_id, created_at FROM p2p_trades ORDER BY created_at DESC"
    );
    const allTrades = tradesResult.rows || [];

    // Get disputed trades count
    const disputesResult = await pool.query(
      "SELECT COUNT(*) as count FROM p2p_trades WHERE status = 'disputed'"
    );
    const openDisputes = parseInt(disputesResult.rows[0]?.count) || 0;

    // Calculate time-based stats
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todayTrades = allTrades.filter(
      (t: any) => new Date(t.created_at) >= today
    ).length;

    const weekTrades = allTrades.filter(
      (t: any) => new Date(t.created_at) >= weekAgo
    ).length;

    const weekVolume = allTrades
      .filter((t: any) => new Date(t.created_at) >= weekAgo)
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount_usdt || 0), 0);

    // Get unique users from trades
    const uniqueUsers = new Set();
    allTrades.forEach((t: any) => {
      uniqueUsers.add(t.buyer_id);
      uniqueUsers.add(t.seller_id);
    });

    res.json({
      activeOffers,
      todayTrades,
      weekTrades,
      openDisputes,
      weekVolume,
      totalUsers: uniqueUsers.size,
      totalTrades: allTrades.length,
    });
  } catch (error: any) {
    console.error("[P2P Admin Stats] Error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Get all offers (admin only)
router.get("/offers", adminMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getSupabasePool();
    
    const result = await pool.query(`
      SELECT o.*, u.email, u.referral_code as ref_code
      FROM p2p_offers o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);

    res.json({ offers: result.rows || [] });
  } catch (error: any) {
    console.error("[P2P Admin Stats] Get offers error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Get all trades (admin only)
router.get("/trades", adminMiddleware, async (req: any, res: Response) => {
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
    `;
    const params: any[] = [];

    if (status) {
      query += " WHERE t.status = $1";
      params.push(status);
    }

    query += " ORDER BY t.created_at DESC";

    const result = await pool.query(query, params);
    res.json({ trades: result.rows || [] });
  } catch (error: any) {
    console.error("[P2P Admin Stats] Get trades error:", error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
