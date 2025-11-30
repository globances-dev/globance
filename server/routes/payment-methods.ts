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

// Get user's payment methods
router.get("/", authMiddleware, async (req: any, res: Response) => {
  try {
    const { fiat_currency_code } = req.query;
    const filters = supabase
      .from("user_payment_methods")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    const { data, error } = fiat_currency_code
      ? await filters.eq("fiat_currency_code", fiat_currency_code)
      : await filters;

    if (error) {
      throw error;
    }

    res.json({ payment_methods: data || [] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get specific payment method
router.get("/:id", authMiddleware, async (req: any, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("user_payment_methods")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    res.json({ payment_method: data });
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

    // Verify fiat currency exists
    const { data: currencyData, error: currencyError } = await supabase
      .from("fiat_currencies")
      .select("code")
      .eq("code", fiat_currency_code.toUpperCase())
      .eq("is_active", true)
      .maybeSingle();

    if (currencyError) {
      throw currencyError;
    }

    if (!currencyData) {
      return res.status(400).json({
        error: `Invalid or inactive currency: ${fiat_currency_code}`,
      });
    }

    const { data, error } = await supabase
      .from("user_payment_methods")
      .insert({
        user_id: req.user.id,
        fiat_currency_code: fiat_currency_code.toUpperCase(),
        provider,
        account_holder_name: account_name,
        account_details: { account_number, ...extra_info },
      })
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(400).json({ error: "Failed to create payment method" });
    }

    res.json({ success: true, payment_method: data });
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

    const updates: any = {};
    if (provider !== undefined) updates.provider = provider;
    if (account_name !== undefined) updates.account_holder_name = account_name;
    if (account_number !== undefined || extra_info !== undefined) {
      const details: any = {};
      if (account_number) details.account_number = account_number;
      if (extra_info) Object.assign(details, extra_info);
      updates.account_details = details;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No updates provided" });
    }

    const { data, error } = await supabase
      .from("user_payment_methods")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    res.json({ success: true, payment_method: data });
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
    const { data, error } = await supabase
      .from("user_payment_methods")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
