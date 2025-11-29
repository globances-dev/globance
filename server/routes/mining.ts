import { Router, Request, Response } from "express";
import { supabase } from "../utils/supabase";
import { verifyToken } from "../utils/jwt";
import {
  recordReferralBonus,
  recordEarningsTransaction,
  getUplineUsers,
} from "../utils/referral";
import { expireOverdueTrades } from "../utils/p2p-cron";

const router = Router();

// Manual trigger endpoint for testing/admin (primary cron is internal via node-cron at 21:00 UTC)
router.post("/process-daily-earnings", async (req: Request, res: Response) => {
  try {
    console.log(
      `[API] Manual trigger of daily earnings processing at ${new Date().toISOString()}`
    );

    // Import and call the internal trigger function
    const { triggerMiningEarnings } = await import("../utils/scheduler");
    await triggerMiningEarnings();

    const now = new Date();
    const todayDate = now.toISOString().split("T")[0];
    const pool = getPostgresPool();

    // Get latest cron log for this date
    const cronLogResult = await pool.query(
      "SELECT * FROM cron_logs WHERE DATE(process_date) = $1 AND process_type = 'daily_earnings' ORDER BY process_date DESC LIMIT 1",
      [todayDate]
    );

    const cronLog = cronLogResult.rows?.[0];

    res.json({
      success: true,
      processed: cronLog?.purchases_processed || 0,
      totalDistributed: cronLog?.total_distributed || 0,
      failedCount: cronLog?.failed_count || 0,
      message: "Mining earnings processed successfully (internal cron system)",
    });
  } catch (error: any) {
    console.error("[API] Error in manual trigger:", error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint - for manual debugging only
router.post("/run-daily-earnings-test", async (req: Request, res: Response) => {
  try {
    const now = new Date();
    console.log(
      `[TEST] Manual daily earnings test run at ${now.toISOString()}`,
    );

    const pool = getPostgresPool();

    // Get all active purchases
    const purchasesResult = await pool.query(
      "SELECT p.*, pkg.daily_percentage FROM purchases p LEFT JOIN packages pkg ON p.package_id = pkg.id WHERE p.status = 'active'"
    );

    const purchases = purchasesResult.rows || [];

    if (purchases.length === 0) {
      console.log("[TEST] No active purchases found");
      return res.json({
        success: true,
        processed: 0,
        message: "No active purchases to process",
      });
    }

    let processed = 0;
    let totalDistributed = 0;
    const failedPurchases = [];

    for (const purchase of purchases) {
      try {
        const dailyEarning = (purchase.amount * (purchase.daily_percentage || 0)) / 100;

        // Credit to user wallet
        await pool.query(
          "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
          [dailyEarning, purchase.user_id]
        );

        totalDistributed += dailyEarning;

        // Record earnings transaction
        try {
          await pool.query(
            `INSERT INTO earnings_transactions (user_id, package_id, amount, type, created_at)
             VALUES ($1, $2, $3, 'daily_mining_income', CURRENT_TIMESTAMP)`,
            [purchase.user_id, purchase.package_id, dailyEarning]
          );
        } catch (txError) {
          console.error(`[MINING] Failed to record transaction:`, txError);
        }

        // Process referral daily earnings
        const upline = await getUplineUsers(purchase.user_id);

        if (upline.level1) {
          const level1Commission = (dailyEarning * 10) / 100;
          await pool.query(
            "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
            [level1Commission, upline.level1]
          );

          await recordReferralBonus(
            purchase.user_id,
            upline.level1,
            level1Commission,
            1,
            "daily_referral_income",
            purchase.package_id,
          );

          totalDistributed += level1Commission;
        }

        if (upline.level2) {
          const level2Commission = (dailyEarning * 3) / 100;
          await pool.query(
            "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
            [level2Commission, upline.level2]
          );

          await recordReferralBonus(
            purchase.user_id,
            upline.level2,
            level2Commission,
            2,
            "daily_referral_income",
            purchase.package_id,
          );

          totalDistributed += level2Commission;
        }

        if (upline.level3) {
          const level3Commission = (dailyEarning * 2) / 100;
          await pool.query(
            "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
            [level3Commission, upline.level3]
          );

          await recordReferralBonus(
            purchase.user_id,
            upline.level3,
            level3Commission,
            3,
            "daily_referral_income",
            purchase.package_id,
          );

          totalDistributed += level3Commission;
        }

        processed++;
      } catch (error) {
        console.error(`[TEST] Error processing purchase ${purchase.id}:`, error);
        failedPurchases.push(purchase.id);
      }
    }

    console.log(
      `[TEST] Processed ${processed} purchases, ${failedPurchases.length} failed, total distributed: ${totalDistributed}`,
    );

    res.json({
      success: true,
      processed,
      failed: failedPurchases.length,
      totalDistributed,
      testMessage:
        "This is a TEST run. It does NOT check for daily idempotency like the real cron does.",
      failedPurchases: failedPurchases.length > 0 ? failedPurchases : undefined,
    });
  } catch (error: any) {
    console.error("[TEST] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's active mining packages
router.get("/my-packages", async (req: any, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const userId = decoded.id;
    const now = new Date();

    console.log(`[MINING] Fetching packages for user: ${userId}`);

    const pool = getPostgresPool();

    // Get all active purchases for this user with package details
    const result = await pool.query(
      `SELECT p.id, p.user_id, p.package_id, p.amount, p.status, p.created_at,
              pkg.name, pkg.daily_percentage, pkg.duration_days
       FROM purchases p
       LEFT JOIN packages pkg ON p.package_id = pkg.id
       WHERE p.user_id = $1 AND p.status = 'active'
       ORDER BY p.created_at DESC`,
      [userId]
    );

    const purchases = result.rows || [];

    console.log(`[MINING] Found ${purchases.length} purchases`);

    if (purchases.length === 0) {
      return res.json({ packages: [] });
    }

    // Filter out expired packages and format response
    const activePackages = purchases.map((p: any) => {
      const startDate = new Date(p.created_at);
      const durationDays = p.duration_days || 270; // Default 270 days
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + durationDays);
      
      const today = new Date();
      const timeDiff = endDate.getTime() - today.getTime();
      const daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
      
      return {
        id: p.id,
        package_id: p.package_id,
        package_name: p.name || p.package_id,
        amount: p.amount,
        daily_percent: p.daily_percentage || 0,
        start_date: p.created_at,
        end_date: endDate.toISOString(),
        days_remaining: daysRemaining,
        total_earned: p.total_earned || 0,
        is_active: daysRemaining > 0,
      };
    });

    console.log(`[MINING] Returning ${activePackages.length} active packages`);

    res.json({ packages: activePackages });
  } catch (error: any) {
    console.error("[MINING] Error fetching packages:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get daily earnings for a user
router.get("/daily-earnings/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const pool = getPostgresPool();

    // Get today's earnings
    const todayDate = new Date().toISOString().split("T")[0];

    const result = await pool.query(
      `SELECT SUM(amount) as total_earned FROM earnings_transactions 
       WHERE user_id = $1 AND DATE(created_at) = $2`,
      [userId, todayDate]
    );

    const totalEarned = result.rows?.[0]?.total_earned || 0;

    res.json({ total_earned: totalEarned, date: todayDate });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
