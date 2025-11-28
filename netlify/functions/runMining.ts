import "dotenv/config";
import { getPostgresPool } from "../../server/utils/postgres";
import {
  recordReferralBonus,
  recordEarningsTransaction,
  getUplineUsers,
} from "../../server/utils/referral";
import { expireOverdueTrades } from "../../server/utils/p2p-cron";

/**
 * Process daily mining earnings
 * Called by CronJob.org external scheduler
 * Required headers: x-cron-secret (must match CRON_SECRET environment variable)
 */
export const handler = async (event: any, context: any) => {
  try {
    // Verify cron secret from CronJob.org
    const cronSecret =
      event.headers["x-cron-secret"] ||
      event.headers["X-Cron-Secret"] ||
      event.queryStringParameters?.secret;

    if (cronSecret !== process.env.CRON_SECRET) {
      console.error("[CronJob] ❌ Invalid or missing CRON_SECRET");
      return {
        statusCode: 401,
        body: JSON.stringify({
          error: "Unauthorized: Invalid cron secret",
        }),
      };
    }

    console.log("[CronJob] ✅ Valid cron secret received");
    console.log("[CronJob] 🚀 Starting daily mining earnings processing...");

    const result = await processDailyMiningEarnings();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Daily mining earnings processed successfully",
        data: result,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error: any) {
    console.error(
      "[CronJob] ❌ Error processing mining earnings:",
      error.message,
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to process mining earnings",
        message: error.message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};

/**
 * Core mining earnings processor
 * Processes daily earnings for all active mining packages
 * Updates user balances, referral commissions, and logs transactions
 */
async function processDailyMiningEarnings() {
  try {
    const now = new Date();
    const todayDate = now.toISOString().split("T")[0]; // YYYY-MM-DD format

    console.log(
      `[Mining] ⏰ Starting daily earnings processing at ${now.toISOString()}`,
    );

    const pool = getPostgresPool();

    // Check if already processed today (idempotency check)
    const cronLogResult = await pool.query(
      "SELECT * FROM cron_logs WHERE DATE(process_date) = $1 AND process_type = 'daily_earnings'",
      [todayDate],
    );

    if (cronLogResult.rows && cronLogResult.rows.length > 0) {
      console.log(`[Mining] ⏭️  Already processed for ${todayDate}, skipping`);
      return {
        status: "skipped",
        reason: "Already processed today",
        date: todayDate,
      };
    }

    // Get all active purchases
    const purchasesResult = await pool.query(
      "SELECT p.*, pkg.daily_percentage FROM purchases p LEFT JOIN packages pkg ON p.package_id = pkg.id WHERE p.status = 'active'",
    );

    const purchases = purchasesResult.rows || [];

    if (purchases.length === 0) {
      console.log("[Mining] No active purchases found");

      // Log the cron run
      await pool.query(
        `INSERT INTO cron_logs (process_type, process_date, purchases_processed, total_distributed)
         VALUES ('daily_earnings', $1, 0, 0)`,
        [now.toISOString()],
      );

      return {
        status: "completed",
        processedCount: 0,
        totalDistributed: 0,
        failedCount: 0,
      };
    }

    let processed = 0;
    let totalDistributed = 0;
    const failedPurchases: string[] = [];

    // Process each active purchase
    for (const purchase of purchases) {
      try {
        const dailyEarning =
          (purchase.amount * (purchase.daily_percentage || 0)) / 100;

        // Credit to user wallet
        await pool.query(
          "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
          [dailyEarning, purchase.user_id],
        );

        totalDistributed += dailyEarning;

        // Record earnings transaction
        console.log(
          `[Mining] Recording transaction for user ${purchase.user_id}: ${dailyEarning} USDT`,
        );

        try {
          await pool.query(
            `INSERT INTO earnings_transactions (user_id, package_id, amount, type, created_at)
             VALUES ($1, $2, $3, 'daily_mining_income', CURRENT_TIMESTAMP)`,
            [purchase.user_id, purchase.package_id, dailyEarning],
          );
        } catch (txError) {
          console.error(`[Mining] Failed to record transaction:`, txError);
        }

        // Process referral daily earnings (10%, 3%, 2%)
        const upline = await getUplineUsers(purchase.user_id);

        if (upline.level1) {
          const level1Commission = (dailyEarning * 10) / 100;
          await pool.query(
            "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
            [level1Commission, upline.level1],
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
            [level2Commission, upline.level2],
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
            [level3Commission, upline.level3],
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
        console.error(
          `[Mining] Error processing purchase ${purchase.id}:`,
          error,
        );
        failedPurchases.push(purchase.id);
      }
    }

    console.log(
      `[Mining] ✅ Processed ${processed} purchases, ${failedPurchases.length} failed, total distributed: ${totalDistributed} USDT`,
    );

    // Run P2P trade expiry check
    console.log("[Mining] Running P2P trade expiry check...");
    const expiredTradeCount = await expireOverdueTrades();
    console.log(
      `[Mining] ✅ P2P trade expiry complete. Expired: ${expiredTradeCount}`,
    );

    // Log the cron run
    await pool.query(
      `INSERT INTO cron_logs (process_type, process_date, purchases_processed, total_distributed, failed_count)
       VALUES ('daily_earnings', $1, $2, $3, $4)`,
      [now.toISOString(), processed, totalDistributed, failedPurchases.length],
    );

    console.log("[Mining] 🎉 Daily earnings cycle complete!");

    return {
      status: "completed",
      processedCount: processed,
      totalDistributed,
      failedCount: failedPurchases.length,
      expiredTrades: expiredTradeCount,
    };
  } catch (error: any) {
    console.error(
      "[Mining] ❌ Error in daily earnings processing:",
      error.message,
    );
    throw error;
  }
}
