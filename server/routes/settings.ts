import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabase } from "../utils/supabase";
import { verifyToken } from "../utils/jwt";

const router = Router();

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
    console.error("[Settings] Middleware error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
};

// Get settings by category
router.get("/category/:category", async (req: Request, res: Response) => {
  try {
    console.log(`📖 Fetching settings for category: ${req.params.category}`);

    const { data: settings, error } = await supabase
      .from("settings")
      .select("id, key, value, category, created_at, updated_at")
      .eq("category", req.params.category)
      .order("key");

    if (error) {
      throw error;
    }

    const results = settings || [];
    console.log(`✅ Retrieved ${results.length} settings:`, results);
    res.json({ settings: results });
  } catch (error: any) {
    console.error("Settings fetch error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Bulk update settings (admin only)
router.post("/bulk-update", adminMiddleware, async (req: any, res: Response) => {
  try {
    console.log("📍 Bulk update endpoint hit");
    console.log("📨 Request body:", JSON.stringify(req.body, null, 2));
    
    const { settings } = z
      .object({
        settings: z.array(
          z.object({
            key: z.string(),
            value: z.string(),
          })
        ),
      })
      .parse(req.body);

    console.log("📋 Parsed settings to update:", settings);
    const updated = [];

    for (const setting of settings) {
      console.log(`\n🔄 Updating ${setting.key}`);
      console.log(`   Value: "${setting.value}"`);

      try {
        const { data, error } = await supabase
          .from("settings")
          .update({ value: setting.value, updated_at: new Date().toISOString() })
          .eq("key", setting.key)
          .select()
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data) {
          console.log(`✅ Successfully updated ${setting.key}`);
          console.log(`   New value: "${data.value}"`);
          updated.push(data);
        } else {
          console.error(`❌ Setting ${setting.key} not found in database`);
        }
      } catch (err) {
        console.error(`❌ Update error for ${setting.key}:`, err);
      }
    }

    console.log(`\n📊 Bulk update complete: ${updated.length}/${settings.length} succeeded`);

    // Log to audit
    await supabase.from("audit_logs").insert({
      admin_id: req.user.id,
      action: "settings_bulk_updated",
      resource_type: "setting",
      details: JSON.stringify({ count: updated.length, keys: settings.map((s) => s.key) }),
    });

    res.json({ success: true, updated: updated.length, settings: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error("❌ Validation error:", error.errors);
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Settings bulk update error:", error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
