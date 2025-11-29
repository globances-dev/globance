import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabase } from "../utils/supabase";
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
    // Verify user is participant in trade
    const { data: tradeData, error: tradeError } = await supabase
      .from("trades")
      .select("buyer_id, seller_id")
      .eq("id", req.params.trade_id)
      .single();

    if (tradeError) {
      if (tradeError.code === "PGRST116") {
        return res.status(404).json({ error: "Trade not found" });
      }
      throw new Error(tradeError.message);
    }

    if (tradeData.buyer_id !== req.user.id && tradeData.seller_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { data: messages, error: messagesError } = await supabase
      .from("p2p_chat")
      .select("*, sender_id")
      .eq("trade_id", req.params.trade_id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      throw new Error(messagesError.message);
    }

    const senderIds = Array.from(new Set((messages || []).map((m) => m.sender_id)));
    let senderMap: Record<string, any> = {};
    if (senderIds.length > 0) {
      const { data: users, error: userError } = await supabase
        .from("users")
        .select("id, email, username")
        .in("id", senderIds);

      if (userError) {
        throw new Error(userError.message);
      }

      senderMap = (users || []).reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as Record<string, any>);
    }

    const messagesWithSenders = (messages || []).map((msg) => ({
      ...msg,
      email: senderMap[msg.sender_id]?.email,
      username: senderMap[msg.sender_id]?.username,
    }));

    res.json({ messages: messagesWithSenders });
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

    // Verify user is participant
    const { data: tradeData, error: tradeError } = await supabase
      .from("trades")
      .select("buyer_id, seller_id")
      .eq("id", req.params.trade_id)
      .single();

    if (tradeError) {
      if (tradeError.code === "PGRST116") {
        return res.status(404).json({ error: "Trade not found" });
      }
      throw new Error(tradeError.message);
    }

    if (tradeData.buyer_id !== req.user.id && tradeData.seller_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { data: insertData, error: insertError } = await supabase
      .from("p2p_chat")
      .insert({
        trade_id: req.params.trade_id,
        sender_id: req.user.id,
        message: message || null,
        attachment_url: attachment_url || null,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insertError || !insertData) {
      return res.status(400).json({ error: insertError?.message || "Failed to send message" });
    }

    res.json({ success: true, message: insertData });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(400).json({ error: error.message });
  }
});

export default router;
