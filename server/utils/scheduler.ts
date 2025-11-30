import cron from "node-cron";
import type { ScheduledTask } from "node-cron";
import { getSupabaseQueryClient, getSupabaseEnvironmentInfo } from "./supabase";
import {
  recordReferralBonus,
  recordEarningsTransaction,
  getUplineUsers,
} from "./referral";
import { expireOverdueTrades } from "./p2p-cron";

const SERVER_BASE_URL = process.env.SERVER_BASE_URL || "http://localhost:5000";
let scheduledJob: ScheduledTask | null = null;

/**
 * Process daily mining earnings internally (no external API calls)
 * Runs at 21:00 UTC every day
 */
async function processDailyEarningsInternal() {
  try {
    const now = new Date();
    const todayDate = now.toISOString().split("T")[0]; // YYYY-MM-DD format

    console.log(
      `[INTERNAL-CRON] ⏰ Starting daily earnings processing at ${now.toISOString()}`
    );

    const supabase = getSupabaseQueryClient();

    // Check if already processed today (idempotency)
    const cronLogResult = await supabase.query(
      "SELECT * FROM cron_logs WHERE DATE(process_date) = $1 AND process_type = 'daily_earnings'",
      [todayDate]
    );

    if (cronLogResult.rows && cronLogResult.rows.length > 0) {
      console.log(`[INTERNAL-CRON] ⏭️  Already processed for ${todayDate}, skipping`);
      return;
    }

    // Get all active purchases
    const purchasesResult = await supabase.query(
      "SELECT p.*, pkg.daily_percentage FROM purchases p LEFT JOIN packages pkg ON p.package_id = pkg.id WHERE p.status = 'active'"
    );

    const purchases = purchasesResult.rows || [];

    if (purchases.length === 0) {
      console.log("[INTERNAL-CRON] No active purchases found");

      // Log the cron run
      await supabase.query(
        `INSERT INTO cron_logs (process_type, process_date, purchases_processed, total_distributed)
         VALUES ('daily_earnings', $1, 0, 0)`,
        [now.toISOString()]
      );

      return;
    }

    let processed = 0;
    let totalDistributed = 0;
    const failedPurchases = [];

    for (const purchase of purchases) {
      try {
        const dailyEarning = (purchase.amount * (purchase.daily_percentage || 0)) / 100;

        // Credit to user wallet
        await supabase.query(
          "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
          [dailyEarning, purchase.user_id]
        );

        totalDistributed += dailyEarning;

        // Record earnings transaction
        console.log(
          `[INTERNAL-CRON] Recording transaction for user ${purchase.user_id}: ${dailyEarning} USDT`
        );
        try {
          await supabase.query(
            `INSERT INTO earnings_transactions (user_id, package_id, amount, type, created_at)
             VALUES ($1, $2, $3, 'daily_mining_income', CURRENT_TIMESTAMP)`,
            [purchase.user_id, purchase.package_id, dailyEarning]
          );
        } catch (txError) {
          console.error(`[INTERNAL-CRON] Failed to record transaction:`, txError);
        }

        // Process referral daily earnings (10%, 3%, 2%)
        const upline = await getUplineUsers(purchase.user_id);

        if (upline.level1) {
          const level1Commission = (dailyEarning * 10) / 100;
          await supabase.query(
            "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
            [level1Commission, upline.level1]
          );

          await recordReferralBonus(
            purchase.user_id,
            upline.level1,
            level1Commission,
            1,
            "daily_referral_income",
            purchase.package_id
          );

          totalDistributed += level1Commission;
        }

        if (upline.level2) {
          const level2Commission = (dailyEarning * 3) / 100;
          await supabase.query(
            "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
            [level2Commission, upline.level2]
          );

          await recordReferralBonus(
            purchase.user_id,
            upline.level2,
            level2Commission,
            2,
            "daily_referral_income",
            purchase.package_id
          );

          totalDistributed += level2Commission;
        }

        if (upline.level3) {
          const level3Commission = (dailyEarning * 2) / 100;
          await supabase.query(
            "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
            [level3Commission, upline.level3]
          );

          await recordReferralBonus(
            purchase.user_id,
            upline.level3,
            level3Commission,
            3,
            "daily_referral_income",
            purchase.package_id
          );

          totalDistributed += level3Commission;
        }

        processed++;
      } catch (error) {
        console.error(`[INTERNAL-CRON] Error processing purchase ${purchase.id}:`, error);
        failedPurchases.push(purchase.id);
      }
    }

    console.log(
      `[INTERNAL-CRON] ✅ Processed ${processed} purchases, ${failedPurchases.length} failed, total distributed: ${totalDistributed} USDT`
    );

    // Run P2P trade expiry check
    console.log("[INTERNAL-CRON] Running P2P trade expiry check...");
    const expiredTradeCount = await expireOverdueTrades();
    console.log(
      `[INTERNAL-CRON] ✅ P2P trade expiry complete. Expired: ${expiredTradeCount}`
    );

    // Log the cron run
    await supabase.query(
      `INSERT INTO cron_logs (process_type, process_date, purchases_processed, total_distributed, failed_count)
       VALUES ('daily_earnings', $1, $2, $3, $4)`,
      [now.toISOString(), processed, totalDistributed, failedPurchases.length]
    );

    console.log("[INTERNAL-CRON] 🎉 Daily earnings cycle complete!");
  } catch (error: any) {
    console.error("[INTERNAL-CRON] ❌ Error in daily earnings processing:", error.message);
  }
}

/**
 * Initialize the internal cron job for daily mining earnings
 * Runs at 21:00 UTC every day (0 21 * * *) - PRODUCTION ONLY
 * No external API calls needed - runs internally on Replit
 */
export function initializeScheduler() {
  const env = getSupabaseEnvironmentInfo();
  console.log(`[Scheduler] 🚀 Initializing internal scheduler (${env.mode})...`);
  
  const isProduction = process.env.ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production';
  
  if (!isProduction) {
    console.log("[Scheduler] ⚠️  DEVELOPMENT MODE: Cron scheduler is DISABLED");
    console.log("[Scheduler] ℹ️  Daily mining runs ONLY in production environment");
    console.log("[Scheduler] 🔧 For testing, use: POST /api/mining/process-daily-earnings");
    return null;
  }

  console.log("[Scheduler] ⏰ Mining cron: 21:00 UTC daily (0 21 * * *)");
  console.log("[Scheduler] 🚀 Running in PRODUCTION - Supabase managed database");

  // Schedule mining earnings at 21:00 UTC every day (PRODUCTION ONLY)
  scheduledJob = cron.schedule("0 21 * * *", async () => {
    console.log("\n" + "=".repeat(60));
    console.log("[PRODUCTION-CRON] 🔔 Scheduled time reached - running daily earnings");
    console.log("=".repeat(60));
    await processDailyEarningsInternal();
    console.log("=".repeat(60) + "\n");
  });

  console.log("[Scheduler] ✅ Internal cron scheduler ACTIVE (Supabase database)");
  console.log("[Scheduler] ✓ Scheduler ready");

  return scheduledJob;
}

/**
 * Manually trigger mining earnings (for testing/admin endpoints)
 */
export async function triggerMiningEarnings() {
  console.log("[Scheduler] 🔧 Manual trigger - processing earnings");
  await processDailyEarningsInternal();
}

/**
 * Get scheduler status for monitoring
 */
export function getSchedulerStatus() {
  return {
    scheduler: "node-cron",
    mode: "INTERNAL (no external dependencies)",
    miningSchedule: "0 21 * * * (21:00 UTC daily)",
    status: scheduledJob ? "🟢 ACTIVE" : "🔴 INACTIVE",
    deploymentSupport: "✅ Runs on Replit (no sleep during execution)",
  };
}
