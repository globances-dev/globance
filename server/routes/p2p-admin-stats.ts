import { Router, Request, Response } from "express";
import { supabase } from "../utils/supabase";
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
    const { data, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", decoded.id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.role !== "admin") {
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
    const [{ data: offers, error: offersError }, { data: trades, error: tradesError }] = await Promise.all([
      supabase.from("offers").select("id, is_active"),
      supabase.from("trades").select("id, status, amount_usdt, buyer_id, seller_id, created_at"),
    ]);

    if (offersError) {
      throw new Error(offersError.message);
    }

    if (tradesError) {
      throw new Error(tradesError.message);
    }

    const activeOffers = (offers || []).filter((o) => o.is_active).length;
    const allTrades = trades || [];

    const openDisputes = allTrades.filter((t: any) => t.status === "disputed").length;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todayTrades = allTrades.filter((t: any) => new Date(t.created_at) >= today).length;

    const weekTrades = allTrades.filter((t: any) => new Date(t.created_at) >= weekAgo).length;

    const weekVolume = allTrades
      .filter((t: any) => new Date(t.created_at) >= weekAgo)
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount_usdt || 0), 0);

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
    const { data: offers, error: offersError } = await supabase
      .from("offers")
      .select("*, user_id")
      .order("created_at", { ascending: false });

    if (offersError) {
      throw new Error(offersError.message);
    }

    const userIds = Array.from(new Set((offers || []).map((o) => o.user_id)));
    let userMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, email, referral_code")
        .in("id", userIds);

      if (usersError) {
        throw new Error(usersError.message);
      }

      userMap = (users || []).reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as Record<string, any>);
    }

    const offersWithUsers = (offers || []).map((offer) => ({
      ...offer,
      email: userMap[offer.user_id]?.email,
      ref_code: userMap[offer.user_id]?.referral_code,
    }));

    res.json({ offers: offersWithUsers });
  } catch (error: any) {
    console.error("[P2P Admin Stats] Get offers error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Get all trades (admin only)
router.get("/trades", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { status } = req.query;

    let tradesQuery = supabase
      .from("trades")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) {
      tradesQuery = tradesQuery.eq("status", status as string);
    }

    const { data: trades, error } = await tradesQuery;
    if (error) {
      throw new Error(error.message);
    }

    const offerIds = Array.from(new Set((trades || []).map((t) => t.offer_id)));
    const userIds = Array.from(
      new Set((trades || []).flatMap((t) => [t.buyer_id, t.seller_id]))
    );

    const [{ data: offers, error: offersError }, { data: users, error: usersError }] = await Promise.all([
      supabase.from("offers").select("id, side, price_fiat_per_usdt").in("id", offerIds),
      supabase.from("users").select("id, email, username").in("id", userIds),
    ]);

    if (offersError) {
      throw new Error(offersError.message);
    }

    if (usersError) {
      throw new Error(usersError.message);
    }

    const offerMap = (offers || []).reduce((acc, offer) => {
      acc[offer.id] = offer;
      return acc;
    }, {} as Record<string, any>);

    const userMap = (users || []).reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {} as Record<string, any>);

    const tradesWithDetails = (trades || []).map((trade) => ({
      ...trade,
      offer_type: offerMap[trade.offer_id]?.side,
      offer_price: offerMap[trade.offer_id]?.price_fiat_per_usdt,
      buyer_email: userMap[trade.buyer_id]?.email,
      buyer_name: userMap[trade.buyer_id]?.username,
      seller_email: userMap[trade.seller_id]?.email,
      seller_name: userMap[trade.seller_id]?.username,
    }));

    res.json({ trades: tradesWithDetails });
  } catch (error: any) {
    console.error("[P2P Admin Stats] Get trades error:", error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
