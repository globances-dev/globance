import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabase } from "../utils/supabase";
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
    console.error("[P2P Trades] Middleware error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
};

// Helper to hydrate trades with related info
const hydrateTrades = async (trades: any[]) => {
  if (!trades.length) return [];

  const offerIds = Array.from(new Set(trades.map((t) => t.offer_id)));
  const userIds = Array.from(
    new Set(trades.flatMap((t) => [t.buyer_id, t.seller_id]))
  );

  const [{ data: offers, error: offersError }, { data: users, error: usersError }] = await Promise.all([
    supabase.from("offers").select("id, side, price_fiat_per_usdt, payment_method_ids, fiat_currency_code").in("id", offerIds),
    supabase.from("users").select("id, email, username").in("id", userIds),
  ]);

  if (offersError) throw new Error(offersError.message);
  if (usersError) throw new Error(usersError.message);

  const offerMap = (offers || []).reduce((acc, offer) => {
    acc[offer.id] = offer;
    return acc;
  }, {} as Record<string, any>);

  const userMap = (users || []).reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {} as Record<string, any>);

  return trades.map((trade) => {
    const offer = offerMap[trade.offer_id] || {};
    return {
      ...trade,
      offer_type: offer.side,
      offer_price: offer.price_fiat_per_usdt,
      payment_methods: offer.payment_method_ids,
      buyer_email: userMap[trade.buyer_id]?.email,
      buyer_name: userMap[trade.buyer_id]?.username,
      seller_email: userMap[trade.seller_id]?.email,
      seller_name: userMap[trade.seller_id]?.username,
    };
  });
};

// Get user's trades (as buyer or seller)
router.get("/my-trades", authMiddleware, async (req: any, res: Response) => {
  try {
    const { status } = req.query;

    let tradesQuery = supabase
      .from("trades")
      .select("*")
      .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`)
      .order("created_at", { ascending: false });

    if (status) {
      tradesQuery = tradesQuery.eq("status", status as string);
    }

    const { data: trades, error } = await tradesQuery;
    if (error) {
      throw new Error(error.message);
    }

    const hydrated = await hydrateTrades(trades || []);
    res.json({ trades: hydrated });
  } catch (error: any) {
    console.error("[P2P Trades] Get my trades error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Get single trade
router.get("/:id", authMiddleware, async (req: any, res: Response) => {
  try {
    const { data: tradeData, error: tradeError } = await supabase
      .from("trades")
      .select("*")
      .eq("id", req.params.id)
      .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`)
      .single();

    if (tradeError) {
      if (tradeError.code === "PGRST116") {
        return res.status(404).json({ error: "Trade not found or access denied" });
      }
      throw new Error(tradeError.message);
    }

    const [hydrated] = await hydrateTrades([tradeData]);
    res.json({ trade: hydrated });
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

    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select("*")
      .eq("id", offer_id)
      .eq("is_active", true)
      .single();

    if (offerError) {
      if (offerError.code === "PGRST116") {
        return res.status(404).json({ error: "Offer not found or inactive" });
      }
      throw new Error(offerError.message);
    }

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
    const { data: buyerMethod, error: buyerMethodError } = await supabase
      .from("user_payment_methods")
      .select("id")
      .eq("id", buyer_payment_method_id)
      .eq("user_id", buyer_id)
      .eq("fiat_currency_code", offer.fiat_currency_code)
      .single();

    if (buyerMethodError) {
      return res.status(400).json({
        error: "Invalid payment method or fiat currency mismatch",
      });
    }

    // For SELL offers, check seller has enough free USDT and lock in escrow
    if (!isBuyOffer) {
      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("usdt_balance, escrow_balance")
        .eq("user_id", seller_id)
        .single();

      if (walletError) {
        throw new Error(walletError.message);
      }

      const freeBalance = parseFloat(wallet?.usdt_balance || 0) - parseFloat(wallet?.escrow_balance || 0);

      if (freeBalance < amount_usdt) {
        return res.status(400).json({
          error: "Seller has insufficient free USDT balance",
        });
      }

      const newEscrow = parseFloat(wallet.escrow_balance || 0) + amount_usdt;
      const { error: lockError } = await supabase
        .from("wallets")
        .update({ escrow_balance: newEscrow })
        .eq("user_id", seller_id);

      if (lockError) {
        throw new Error(lockError.message);
      }
    }

    // Create trade with 30-minute payment window
    const payment_deadline = new Date();
    payment_deadline.setMinutes(payment_deadline.getMinutes() + 30);

    const { data: tradeResult, error: tradeError } = await supabase
      .from("trades")
      .insert({
        offer_id,
        buyer_id,
        seller_id,
        amount_usdt,
        price_fiat_per_usdt: offer.price_fiat_per_usdt,
        total_fiat,
        fiat_currency_code: offer.fiat_currency_code,
        status: "pending",
        escrow_amount_usdt: isBuyOffer ? 0 : amount_usdt,
        payment_deadline: payment_deadline.toISOString(),
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (tradeError || !tradeResult) {
      return res.status(400).json({ error: tradeError?.message || "Failed to create trade" });
    }

    const newRemaining = remainingAmount - amount_usdt;
    const { error: offerUpdateError } = await supabase
      .from("offers")
      .update({
        remaining_amount_usdt: newRemaining,
        is_active: newRemaining > 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", offer_id);

    if (offerUpdateError) {
      throw new Error(offerUpdateError.message);
    }

    // Create notifications (non-blocking)
    (async () => {
      try {
        await createP2PNotification(buyer_id, "trade_started", "Trade Started", `You have started a P2P trade for ${amount_usdt} USDT`, { trade_id: tradeResult.id });
        await createP2PNotification(seller_id, "trade_started", "New Trade", `A buyer has taken your offer for ${amount_usdt} USDT`, { trade_id: tradeResult.id });
      } catch (err) {
        console.error("Error creating trade notifications:", err);
      }
    })();

    res.json({ success: true, trade: tradeResult });
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

    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .select("*")
      .eq("id", req.params.id)
      .eq("buyer_id", req.user.id)
      .eq("status", "pending")
      .single();

    if (tradeError) {
      if (tradeError.code === "PGRST116") {
        return res.status(404).json({ error: "Trade not found or already processed" });
      }
      throw new Error(tradeError.message);
    }

    if (new Date(trade.payment_deadline) < new Date()) {
      return res.status(400).json({ error: "Payment deadline has passed" });
    }

    const { data: updatedTrade, error: updateError } = await supabase
      .from("trades")
      .update({ status: "payment_sent", updated_at: new Date().toISOString(), payment_receipt_url: payment_receipt_url || null })
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Create notifications (non-blocking)
    (async () => {
      try {
        await createP2PNotification(trade.seller_id, "payment_sent", "Payment Marked", `Buyer marked payment as sent for ${trade.amount_usdt} USDT`, { trade_id: trade.id });
      } catch (err) {
        console.error("Error creating payment notification:", err);
      }
    })();

    res.json({ success: true, trade: updatedTrade });
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
    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .select("*")
      .eq("id", req.params.id)
      .eq("seller_id", req.user.id)
      .eq("status", "payment_sent")
      .single();

    if (tradeError) {
      if (tradeError.code === "PGRST116") {
        return res.status(404).json({
          error: "Trade not found or not ready for release",
        });
      }
      throw new Error(tradeError.message);
    }

    // Release from seller escrow
    const { data: sellerWallet, error: sellerWalletError } = await supabase
      .from("wallets")
      .select("escrow_balance")
      .eq("user_id", trade.seller_id)
      .single();

    if (sellerWalletError) {
      throw new Error(sellerWalletError.message);
    }

    const newEscrow = parseFloat(sellerWallet?.escrow_balance || 0) - parseFloat(trade.escrow_amount_usdt || 0);
    const { error: updateSeller } = await supabase
      .from("wallets")
      .update({ escrow_balance: newEscrow })
      .eq("user_id", trade.seller_id);

    if (updateSeller) {
      throw new Error(updateSeller.message);
    }

    // Add to buyer balance
    const { data: buyerWallet, error: buyerWalletError } = await supabase
      .from("wallets")
      .select("usdt_balance")
      .eq("user_id", trade.buyer_id)
      .single();

    if (buyerWalletError) {
      throw new Error(buyerWalletError.message);
    }

    const newBuyerBalance = parseFloat(buyerWallet?.usdt_balance || 0) + parseFloat(trade.amount_usdt || 0);
    const { error: updateBuyer } = await supabase
      .from("wallets")
      .update({ usdt_balance: newBuyerBalance })
      .eq("user_id", trade.buyer_id);

    if (updateBuyer) {
      throw new Error(updateBuyer.message);
    }

    const { data: updatedTrade, error: updateTradeError } = await supabase
      .from("trades")
      .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (updateTradeError) {
      throw new Error(updateTradeError.message);
    }

    // Create notifications (non-blocking)
    (async () => {
      try {
        await createP2PNotification(trade.buyer_id, "released", "Funds Released", `Seller released ${trade.amount_usdt} USDT to your wallet`, { trade_id: trade.id });
        await createP2PNotification(trade.seller_id, "released", "Trade Completed", `You released ${trade.amount_usdt} USDT. Trade completed`, { trade_id: trade.id });
      } catch (err) {
        console.error("Error creating release notifications:", err);
      }
    })();

    res.json({ success: true, trade: updatedTrade });
  } catch (error: any) {
    console.error("[P2P Trades] Release error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Cancel trade (buyer only, before payment sent)
router.post("/:id/cancel", authMiddleware, async (req: any, res: Response) => {
  try {
    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .select("*")
      .eq("id", req.params.id)
      .eq("buyer_id", req.user.id)
      .eq("status", "pending")
      .single();

    if (tradeError) {
      if (tradeError.code === "PGRST116") {
        return res.status(404).json({
          error: "Trade not found. Only buyers can cancel pending trades before marking payment as sent.",
        });
      }
      throw new Error(tradeError.message);
    }

    // Release escrow back to seller
    if (parseFloat(trade.escrow_amount_usdt || 0) > 0) {
      const { data: sellerWallet, error: sellerWalletError } = await supabase
        .from("wallets")
        .select("escrow_balance")
        .eq("user_id", trade.seller_id)
        .single();

      if (sellerWalletError) {
        throw new Error(sellerWalletError.message);
      }

      const newEscrow = parseFloat(sellerWallet?.escrow_balance || 0) - parseFloat(trade.escrow_amount_usdt || 0);
      const { error: updateSeller } = await supabase
        .from("wallets")
        .update({ escrow_balance: newEscrow })
        .eq("user_id", trade.seller_id);

      if (updateSeller) {
        throw new Error(updateSeller.message);
      }
    }

    // Return amount to offer
    const { data: offerData, error: offerError } = await supabase
      .from("offers")
      .select("remaining_amount_usdt")
      .eq("id", trade.offer_id)
      .single();

    if (offerError) {
      throw new Error(offerError.message);
    }

    const newRemaining = parseFloat(offerData?.remaining_amount_usdt || 0) + parseFloat(trade.amount_usdt || 0);
    const { error: updateOffer } = await supabase
      .from("offers")
      .update({ remaining_amount_usdt: newRemaining, is_active: true, updated_at: new Date().toISOString() })
      .eq("id", trade.offer_id);

    if (updateOffer) {
      throw new Error(updateOffer.message);
    }

    const { data: updatedTrade, error: updateTradeError } = await supabase
      .from("trades")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (updateTradeError) {
      throw new Error(updateTradeError.message);
    }

    // Create notifications (non-blocking)
    (async () => {
      try {
        await createP2PNotification(trade.buyer_id, "cancelled", "Trade Cancelled", `You cancelled the trade. Amount returned to seller`, { trade_id: trade.id });
        await createP2PNotification(trade.seller_id, "cancelled", "Trade Cancelled", `Buyer cancelled the trade. Escrow released back to your wallet`, { trade_id: trade.id });
      } catch (err) {
        console.error("Error creating cancel notifications:", err);
      }
    })();

    res.json({ success: true, trade: updatedTrade });
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

    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .select("*")
      .eq("id", req.params.id)
      .in("status", ["payment_sent"])
      .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`)
      .single();

    if (tradeError) {
      if (tradeError.code === "PGRST116") {
        return res.status(404).json({
          error: "Trade not found or cannot be disputed",
        });
      }
      throw new Error(tradeError.message);
    }

    const { data: updatedTrade, error: updateError } = await supabase
      .from("trades")
      .update({ status: "disputed", dispute_reason, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Create notifications (non-blocking)
    (async () => {
      try {
        await createP2PNotification(trade.buyer_id, "dispute_opened", "Dispute Opened", `Dispute opened on trade. Admin will review shortly`, { trade_id: trade.id });
        await createP2PNotification(trade.seller_id, "dispute_opened", "Dispute Opened", `Dispute opened on trade. Admin will review shortly`, { trade_id: trade.id });
      } catch (err) {
        console.error("Error creating dispute notifications:", err);
      }
    })();

    res.json({ success: true, trade: updatedTrade });
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

    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .select("*")
      .eq("id", req.params.id)
      .eq("status", "disputed")
      .single();

    if (tradeError) {
      if (tradeError.code === "PGRST116") {
        return res.status(404).json({ error: "Disputed trade not found" });
      }
      throw new Error(tradeError.message);
    }

    const newStatus = resolution === "buyer" ? "completed" : "cancelled";

    // Handle funds based on resolution
    if (resolution === "buyer") {
      const { data: sellerWallet, error: sellerWalletError } = await supabase
        .from("wallets")
        .select("escrow_balance")
        .eq("user_id", trade.seller_id)
        .single();

      if (sellerWalletError) {
        throw new Error(sellerWalletError.message);
      }

      const updatedEscrow = parseFloat(sellerWallet?.escrow_balance || 0) - parseFloat(trade.escrow_amount_usdt || 0);
      const { error: updateSeller } = await supabase
        .from("wallets")
        .update({ escrow_balance: updatedEscrow })
        .eq("user_id", trade.seller_id);

      if (updateSeller) {
        throw new Error(updateSeller.message);
      }

      const { data: buyerWallet, error: buyerWalletError } = await supabase
        .from("wallets")
        .select("usdt_balance")
        .eq("user_id", trade.buyer_id)
        .single();

      if (buyerWalletError) {
        throw new Error(buyerWalletError.message);
      }

      const newBuyerBalance = parseFloat(buyerWallet?.usdt_balance || 0) + parseFloat(trade.amount_usdt || 0);
      const { error: updateBuyer } = await supabase
        .from("wallets")
        .update({ usdt_balance: newBuyerBalance })
        .eq("user_id", trade.buyer_id);

      if (updateBuyer) {
        throw new Error(updateBuyer.message);
      }
    } else {
      const { data: sellerWallet, error: sellerWalletError } = await supabase
        .from("wallets")
        .select("escrow_balance, usdt_balance")
        .eq("user_id", trade.seller_id)
        .single();

      if (sellerWalletError) {
        throw new Error(sellerWalletError.message);
      }

      const updatedEscrow = parseFloat(sellerWallet?.escrow_balance || 0) - parseFloat(trade.escrow_amount_usdt || 0);
      const updatedBalance = parseFloat(sellerWallet?.usdt_balance || 0) + parseFloat(trade.escrow_amount_usdt || 0);
      const { error: updateSeller } = await supabase
        .from("wallets")
        .update({ escrow_balance: updatedEscrow, usdt_balance: updatedBalance })
        .eq("user_id", trade.seller_id);

      if (updateSeller) {
        throw new Error(updateSeller.message);
      }
    }

    const { data: updatedTrade, error: updateTradeError } = await supabase
      .from("trades")
      .update({
        status: newStatus,
        dispute_resolved_by: req.user.id,
        dispute_resolution: notes || `Resolved in favor of ${resolution}`,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (updateTradeError) {
      throw new Error(updateTradeError.message);
    }

    await supabase.from("audit_logs").insert({
      admin_id: req.user.id,
      action: "p2p_dispute_resolved",
      resource_type: "trade",
      resource_id: trade.id,
      details: JSON.stringify({ resolution, notes }),
    });

    // Create notifications (non-blocking)
    (async () => {
      try {
        const beneficiary = resolution === "buyer" ? trade.buyer_id : trade.seller_id;
        const loser = resolution === "buyer" ? trade.seller_id : trade.buyer_id;

        await createP2PNotification(beneficiary, "dispute_resolved", "Dispute Resolved - You Won", `Admin resolved dispute in your favor`, { trade_id: trade.id });
        await createP2PNotification(loser, "dispute_resolved", "Dispute Resolved", `Admin resolved dispute. Resolution: ${resolution}`, { trade_id: trade.id });
      } catch (err) {
        console.error("Error creating dispute resolved notifications:", err);
      }
    })();

    res.json({ success: true, trade: updatedTrade });
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
    const { data: trades, error } = await supabase
      .from("trades")
      .select("*")
      .eq("status", "disputed")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const hydrated = await hydrateTrades(trades || []);
    res.json({ trades: hydrated });
  } catch (error: any) {
    console.error("[P2P Trades] Get disputes error:", error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
