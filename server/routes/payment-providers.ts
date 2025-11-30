import { Router, Request, Response } from "express";
import { z } from "zod";
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

    if (error || !data || data.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    req.user = decoded;
    next();
  } catch (error: any) {
    console.error("[Payment Providers] Middleware error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
};

// Get all approved payment providers (public - for users creating offers)
router.get("/", async (req: Request, res: Response) => {
  try {
    const { fiat_currency_code, type } = req.query;
    let query = supabase
      .from("approved_payment_providers")
      .select("*")
      .eq("is_active", true)
      .order("type")
      .order("name");

    if (fiat_currency_code) {
      query = query.eq("fiat_currency", fiat_currency_code.toString().toUpperCase());
    }

    if (type) {
      query = query.eq("type", type as string);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    res.json({ providers: data || [] });
  } catch (error: any) {
    console.error("[Payment Providers] Error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Get all approved payment providers including inactive (admin only)
router.get("/all", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("approved_payment_providers")
      .select("*")
      .order("fiat_currency")
      .order("type")
      .order("name");

    if (error) {
      throw error;
    }

    res.json({ providers: data || [] });
  } catch (error: any) {
    console.error("[Payment Providers] Get all error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Create approved payment provider (admin only)
router.post("/", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { fiat_currency_code, type, provider_name, is_active } = z
      .object({
        fiat_currency_code: z.string().min(2).max(10).toUpperCase(),
        type: z.enum(["bank", "mobile_money", "wallet", "other"]),
        provider_name: z.string().min(2),
        is_active: z.boolean().optional().default(true),
      })
      .parse(req.body);

    // Verify fiat currency exists
    const { data: currencyData, error: currencyError } = await supabase
      .from("fiat_currencies")
      .select("code")
      .eq("code", fiat_currency_code)
      .maybeSingle();

    if (currencyError) {
      throw currencyError;
    }

    if (!currencyData) {
      return res.status(400).json({
        error: `Invalid currency: ${fiat_currency_code}`,
      });
    }

    const { data, error } = await supabase
      .from("approved_payment_providers")
      .insert({
        fiat_currency: fiat_currency_code,
        type,
        name: provider_name,
        is_active,
      })
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(400).json({ error: "Failed to create payment provider" });
    }

    await supabase.from("audit_logs").insert({
      admin_id: req.user.id,
      action: "payment_provider_created",
      resource_type: "payment_provider",
      resource_id: data.id,
      details: JSON.stringify({ fiat_currency_code, type, provider_name }),
    });

    res.json({ success: true, provider: data });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.code === "23505") {
      return res.status(400).json({
        error: "This provider already exists for this currency",
      });
    }
    console.error("[Payment Providers] Create error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Update approved payment provider (admin only)
router.put("/:id", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { provider_name, is_active } = z
      .object({
        provider_name: z.string().min(2).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(req.body);

    const updates: Record<string, any> = {};

    if (provider_name !== undefined) {
      updates.name = provider_name;
    }
    if (is_active !== undefined) {
      updates.is_active = is_active;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No updates provided" });
    }

    const { data, error } = await supabase
      .from("approved_payment_providers")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: "Payment provider not found" });
    }

    await supabase.from("audit_logs").insert({
      admin_id: req.user.id,
      action: "payment_provider_updated",
      resource_type: "payment_provider",
      resource_id: req.params.id,
      details: JSON.stringify({ provider_name, is_active }),
    });

    res.json({ success: true, provider: data });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("[Payment Providers] Update error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Delete approved payment provider (admin only)
router.delete("/:id", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("approved_payment_providers")
      .delete()
      .eq("id", req.params.id)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: "Payment provider not found" });
    }

    await supabase.from("audit_logs").insert({
      admin_id: req.user.id,
      action: "payment_provider_deleted",
      resource_type: "payment_provider",
      resource_id: req.params.id,
      details: JSON.stringify({ fiat_currency: data.fiat_currency, name: data.name }),
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Payment Providers] Delete error:", error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
