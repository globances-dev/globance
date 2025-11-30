import { Router, Request, Response } from "express";
import { z } from "zod";
import { getSupabaseQueryClient } from "../utils/supabase";
import { verifyToken } from "../utils/jwt";

const router = Router();

console.log("[Settings API] Initialized - Supabase client active");

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
    const db = getSupabaseQueryClient();
    const result = await db.exec(
      "SELECT role FROM users WHERE id = $1",
      [decoded.id]
    );

    if (!result.rows.length || result.rows[0].role !== "admin") {
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
    
    const db = getSupabaseQueryClient();
    const result = await db.exec(
      "SELECT id, key, value, category, created_at, updated_at FROM settings WHERE category = $1 ORDER BY key",
      [req.params.category]
    );

    const settings = result.rows;
    console.log(`✅ Retrieved ${settings.length} settings:`, settings);
    res.json({ settings });
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

    const db = getSupabaseQueryClient();
    const updated = [];
    
    for (const setting of settings) {
      console.log(`\n🔄 Updating ${setting.key}`);
      console.log(`   Value: "${setting.value}"`);
      
      try {
        const result = await db.exec(
          "UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *",
          [setting.value, setting.key]
        );

        if (result.rows.length > 0) {
          console.log(`✅ Successfully updated ${setting.key}`);
          console.log(`   New value: "${result.rows[0].value}"`);
          updated.push(result.rows[0]);
        } else {
          console.error(`❌ Setting ${setting.key} not found in database`);
        }
      } catch (err) {
        console.error(`❌ Update error for ${setting.key}:`, err);
      }
    }

    console.log(`\n📊 Bulk update complete: ${updated.length}/${settings.length} succeeded`);

    // Log to audit
    await db.exec(
      `INSERT INTO audit_logs (admin_id, action, resource_type, details)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, "settings_bulk_updated", "setting", JSON.stringify({ count: updated.length, keys: settings.map(s => s.key) })]
    );

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
