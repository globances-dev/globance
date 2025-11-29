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

// Get all active offers (with filters)
router.get("/", async (req: Request, res: Response) => {
  try {
    const { side, fiat_currency_code, country, payment_method } = req.query;

    let offersQuery = supabase
      .from("offers")
      .select("*")
      .eq("is_active", true)
      .gt("remaining_amount_usdt", 0);

    if (side) {
      offersQuery = offersQuery.eq("side", side as string);
    }

    if (fiat_currency_code) {
      offersQuery = offersQuery.eq("fiat_currency_code", fiat_currency_code as string);
    }

    if (country) {
      offersQuery = offersQuery.ilike("country", `%${country}%`);
    }

    const { data: offersData, error: offersError } = await offersQuery;
    if (offersError) {
      throw new Error(offersError.message);
    }

    const offers = offersData || [];

    // Filter by payment method if specified
    let filteredOffers = offers;
    if (payment_method && typeof payment_method === "string") {
      const { data: methods, error: methodsError } = await supabase
        .from("user_payment_methods")
        .select("id")
        .ilike("provider_name", `%${payment_method}%`);

      if (methodsError) {
        throw new Error(methodsError.message);
      }

      const methodIds = methods?.map((m) => m.id) || [];
      filteredOffers = offers.filter((offer) => {
        const pmIds = offer.payment_method_ids || [];
        return pmIds.some((id: string) => methodIds.includes(id));
      });
    }

    // Attach user info
    const userIds = Array.from(new Set(filteredOffers.map((o: any) => o.user_id)));
    let userMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users, error: userError } = await supabase
        .from("users")
        .select("id, email, username")
        .in("id", userIds);

      if (userError) {
        throw new Error(userError.message);
      }

      userMap = (users || []).reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as Record<string, any>);
    }

    const sortedOffers = [...filteredOffers].sort((a, b) => {
      if (side === "buy") {
        return a.price_fiat_per_usdt - b.price_fiat_per_usdt;
      }
      return b.price_fiat_per_usdt - a.price_fiat_per_usdt;
    });

    const offersWithUsers = sortedOffers.map((offer) => ({
      ...offer,
      email: userMap[offer.user_id]?.email,
      username: userMap[offer.user_id]?.username,
    }));

    res.json({ offers: offersWithUsers });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get user's own offers
router.get("/my-offers", authMiddleware, async (req: any, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("offers")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    res.json({ offers: data || [] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get single offer
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { data: offerData, error: offerError } = await supabase
      .from("offers")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (offerError) {
      if (offerError.code === "PGRST116") {
        return res.status(404).json({ error: "Offer not found" });
      }
      throw new Error(offerError.message);
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("email, username")
      .eq("id", offerData.user_id)
      .single();

    if (userError) {
      throw new Error(userError.message);
    }

    res.json({ offer: { ...offerData, ...userData } });
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

    // Validate max limits are consistent with total amount
    const total_fiat = total_amount_usdt * price_fiat_per_usdt;
    if (max_limit_fiat > total_fiat) {
      return res.status(400).json({
        error: `max_limit_fiat cannot exceed total offer value (${total_fiat.toFixed(2)} ${fiat_currency_code})`,
      });
    }

    // Get fiat currency and validate price range
    const { data: currencyResult, error: currencyError } = await supabase
      .from("p2p_price_ranges")
      .select("min_price, max_price")
      .eq("code", fiat_currency_code)
      .eq("is_active", true)
      .single();

    if (currencyError) {
      if (currencyError.code === "PGRST116") {
        return res.status(400).json({
          error: `Invalid or inactive currency: ${fiat_currency_code}`,
        });
      }
      throw new Error(currencyError.message);
    }

    const currency = currencyResult;

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
    const { data: methodsResult, error: methodsError } = await supabase
      .from("user_payment_methods")
      .select("id, fiat_currency_code")
      .eq("user_id", req.user.id)
      .eq("is_active", true);

    if (methodsError) {
      throw new Error(methodsError.message);
    }

    const userMethods = methodsResult || [];
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
      const { data: walletData, error: walletError } = await supabase
        .from("wallets")
        .select("usdt_balance, escrow_balance")
        .eq("user_id", req.user.id)
        .single();

      if (walletError) {
        throw new Error(walletError.message);
      }

      const wallet = walletData;
      const freeBalance = (wallet.usdt_balance || 0) - (wallet.escrow_balance || 0);

      if (freeBalance < total_amount_usdt) {
        return res.status(400).json({
          error: `Insufficient free USDT balance. You have ${freeBalance} USDT available but offer requires ${total_amount_usdt} USDT`,
        });
      }
    }

    // Create offer
    const { data: insertData, error: insertError } = await supabase
      .from("offers")
      .insert({
        user_id: req.user.id,
        side,
        total_amount_usdt,
        remaining_amount_usdt: total_amount_usdt,
        price_fiat_per_usdt,
        fiat_currency_code,
        country,
        min_limit_fiat,
        max_limit_fiat,
        payment_method_ids,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insertError || !insertData) {
      return res.status(400).json({ error: insertError?.message || "Failed to create offer" });
    }

    res.json({ success: true, offer: insertData });
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

    // Get current offer
    const { data: currentOffer, error: currentError } = await supabase
      .from("offers")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .single();

    if (currentError) {
      if (currentError.code === "PGRST116") {
        return res.status(404).json({ error: "Offer not found" });
      }
      throw new Error(currentError.message);
    }

    const updates: any = {};

    // Validate and set price if changed
    if (price_fiat_per_usdt !== undefined) {
      const { data: currency, error: currencyError } = await supabase
        .from("p2p_price_ranges")
        .select("min_price, max_price")
        .eq("code", currentOffer.fiat_currency_code)
        .single();

      if (currencyError) {
        throw new Error(currencyError.message);
      }

      if (
        price_fiat_per_usdt < currency.min_price ||
        price_fiat_per_usdt > currency.max_price
      ) {
        return res.status(400).json({
          error: `Price must be between ${currency.min_price} and ${currency.max_price} ${currentOffer.fiat_currency_code}`,
        });
      }

      updates.price_fiat_per_usdt = price_fiat_per_usdt;
    }

    if (min_limit_fiat !== undefined) updates.min_limit_fiat = min_limit_fiat;
    if (max_limit_fiat !== undefined) updates.max_limit_fiat = max_limit_fiat;
    if (payment_method_ids !== undefined) updates.payment_method_ids = payment_method_ids;
    if (is_active !== undefined) updates.is_active = is_active;

    // Validate limits
    const finalMin = updates.min_limit_fiat ?? currentOffer.min_limit_fiat;
    const finalMax = updates.max_limit_fiat ?? currentOffer.max_limit_fiat;
    if (finalMin >= finalMax) {
      return res
        .status(400)
        .json({ error: "min_limit_fiat must be less than max_limit_fiat" });
    }

    const updateCols = Object.keys(updates);
    if (updateCols.length === 0) {
      return res.json({ success: true, offer: currentOffer });
    }

    const { data: updateData, error: updateError } = await supabase
      .from("offers")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (updateError || !updateData) {
      return res.status(400).json({ error: updateError?.message || "Failed to update offer" });
    }

    res.json({ success: true, offer: updateData });
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
    // Check if offer has active trades
    const { data: trades, error: tradesError } = await supabase
      .from("trades")
      .select("id")
      .eq("offer_id", req.params.id)
      .in("status", ["pending", "payment_sent", "disputed"]);

    if (tradesError) {
      throw new Error(tradesError.message);
    }

    if (trades && trades.length > 0) {
      return res.status(400).json({
        error: "Cannot delete offer with active trades",
      });
    }

    const { data: deleteData, error: deleteError } = await supabase
      .from("offers")
      .update({ is_active: false })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .select("*")
      .single();

    if (deleteError || !deleteData) {
      return res.status(404).json({ error: "Offer not found" });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
