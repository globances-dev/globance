import { getSupabaseAdmin } from "./supabase";
import { createP2PNotification } from "./p2p-notifications";

/**
 * Expire trades where payment deadline has passed
 * Run this via cron job (attached to mining cron for efficiency)
 */
export async function expireOverdueTrades() {
  try {
    console.log("[P2P Cron] Checking for expired trades...");

    const supabase = getSupabaseAdmin();

    // Find trades that are pending and past payment_deadline
    const { data: expiredTrades, error } = await supabase
      .from("trades")
      .select("*")
      .eq("status", "pending")
      .lt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString()); // 30 minutes ago

    if (error) {
      console.error("[P2P Cron] Database error:", error);
      return 0;
    }

    if (!expiredTrades || expiredTrades.length === 0) {
      console.log("[P2P Cron] No expired trades found");
      return 0;
    }

    console.log(`[P2P Cron] Found ${expiredTrades.length} expired trades`);
    let processedCount = 0;

    for (const trade of expiredTrades) {
      try {
        // Release escrow back to seller
        if (parseFloat(trade.escrow_amount || 0) > 0) {
          await supabase
            .from("wallets")
            .update({ escrow_balance: 0 })
            .eq("user_id", trade.seller_id);
        }

        // Return amount to offer
        await supabase
          .from("offers")
          .update({ status: "active" })
          .eq("id", trade.offer_id);

        // Update trade status
        await supabase
          .from("trades")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", trade.id);

        // Create notifications (non-blocking)
        (async () => {
          try {
            await createP2PNotification(
              trade.buyer_id,
              "cancelled",
              "Trade Expired",
              `Your P2P trade expired due to non-payment. The offer has been returned to the seller.`,
              { trade_id: trade.id },
            );

            await createP2PNotification(
              trade.seller_id,
              "cancelled",
              "Trade Expired",
              `Your P2P trade expired due to buyer non-payment. Escrow has been released back to your wallet.`,
              { trade_id: trade.id },
            );
          } catch (err) {
            console.error("[P2P Cron] Error creating notifications:", err);
          }
        })();

        processedCount++;
        console.log(`[P2P Cron] Expired trade ${trade.id}`);
      } catch (err) {
        console.error(`[P2P Cron] Error expiring trade ${trade.id}:`, err);
      }
    }

    console.log(
      `[P2P Cron] Trade expiry check complete. Processed: ${processedCount}`,
    );
    return processedCount;
  } catch (error) {
    console.error("[P2P Cron] Fatal error in expireOverdueTrades:", error);
    return 0;
  }
}
