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
};

// Get all active fiat currencies (public)
router.get("/", async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("fiat_currencies")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      throw error;
    }

    res.json({ currencies: data || [] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get all fiat currencies including inactive (admin only)
router.get("/all", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("fiat_currencies")
      .select("*")
      .order("name");

    if (error) {
      throw error;
    }

    res.json({ currencies: data || [] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get single fiat currency
router.get("/:code", async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("fiat_currencies")
      .select("*")
      .eq("code", req.params.code.toUpperCase())
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: "Currency not found" });
    }

    res.json({ currency: data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Create fiat currency (admin only)
router.post("/", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { code, name, min_price, max_price, is_active } = z
      .object({
        code: z.string().min(2).max(10),
        name: z.string().min(2),
        min_price: z.number().positive(),
        max_price: z.number().positive(),
        is_active: z.boolean().optional().default(true),
      })
      .parse(req.body);

    if (min_price >= max_price) {
      return res
        .status(400)
        .json({ error: "min_price must be less than max_price" });
    }

    const { data, error } = await supabase
      .from("fiat_currencies")
      .insert({
        code: code.toUpperCase(),
        name,
        min_price,
        max_price,
        is_active,
      })
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(400).json({ error: "Failed to create currency" });
    }

    const currency = data;

    // Audit log
    await supabase.from("audit_logs").insert({
      admin_id: req.user.id,
      action: "fiat_currency_created",
      resource_type: "fiat_currency",
      details: JSON.stringify({ code, name }),
    });

    res.json({ success: true, currency });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(400).json({ error: error.message });
  }
});

// Update fiat currency (admin only)
router.put("/:code", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { name, min_price, max_price, is_active } = z
      .object({
        name: z.string().min(2).optional(),
        min_price: z.number().positive().optional(),
        max_price: z.number().positive().optional(),
        is_active: z.boolean().optional(),
      })
      .parse(req.body);

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (min_price !== undefined) updates.min_price = min_price;
    if (max_price !== undefined) updates.max_price = max_price;
    if (is_active !== undefined) updates.is_active = is_active;

    // Validate min < max
    if (updates.min_price !== undefined || updates.max_price !== undefined) {
      const { data: currData, error: currError } = await supabase
        .from("fiat_currencies")
        .select("min_price, max_price")
        .eq("code", req.params.code.toUpperCase())
        .maybeSingle();

      if (currError) {
        throw currError;
      }

      if (!currData) {
        return res.status(404).json({ error: "Currency not found" });
      }

      const finalMin = updates.min_price ?? currData.min_price;
      const finalMax = updates.max_price ?? currData.max_price;

      if (finalMin >= finalMax) {
        return res
          .status(400)
          .json({ error: "min_price must be less than max_price" });
      }
    }

    const { data, error } = await supabase
      .from("fiat_currencies")
      .update(updates)
      .eq("code", req.params.code.toUpperCase())
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: "Currency not found" });
    }

    const currency = data;

    // Audit log
    await supabase.from("audit_logs").insert({
      admin_id: req.user.id,
      action: "fiat_currency_updated",
      resource_type: "fiat_currency",
      details: JSON.stringify(updates),
    });

    res.json({ success: true, currency });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(400).json({ error: error.message });
  }
});

// Delete fiat currency (admin only)
router.delete("/:code", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("fiat_currencies")
      .delete()
      .eq("code", req.params.code.toUpperCase())
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: "Currency not found" });
    }

    const currency = data;

    // Audit log
    await supabase.from("audit_logs").insert({
      admin_id: req.user.id,
      action: "fiat_currency_deleted",
      resource_type: "fiat_currency",
      details: JSON.stringify({ code: currency.code, name: currency.name }),
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
