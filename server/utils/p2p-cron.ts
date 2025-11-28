import { getPostgresPool } from "./postgres";
import { createP2PNotification } from "./p2p-notifications";

/**
 * Expire trades where payment deadline has passed
 * Run this via cron job (attached to mining cron for efficiency)
 */
export async function expireOverdueTrades() {
  try {
    console.log("[P2P Cron] Checking for expired trades...");

    const pool = getPostgresPool();

    // Find trades that are pending and past payment_deadline
    const expiredResult = await pool.query(`
      SELECT * FROM p2p_trades 
      WHERE status = 'pending' AND payment_deadline < NOW()
    `);

    if (!expiredResult.rows || expiredResult.rows.length === 0) {
      console.log("[P2P Cron] No expired trades found");
      return 0;
    }

    const expiredTrades = expiredResult.rows;
    console.log(`[P2P Cron] Found ${expiredTrades.length} expired trades`);
    let processedCount = 0;

    for (const trade of expiredTrades) {
      try {
        // Release escrow back to seller
        if (parseFloat(trade.escrow_amount || 0) > 0) {
          await pool.query(
            "UPDATE wallets SET escrow_balance = escrow_balance - $1 WHERE user_id = $2",
            [trade.escrow_amount, trade.seller_id]
          );
        }

        // Return amount to offer
        await pool.query(`
          UPDATE p2p_offers 
          SET filled_amount = COALESCE(filled_amount, 0) - $1, is_active = true
          WHERE id = $2
        `, [trade.amount_usdt, trade.offer_id]);

        // Update trade status
        await pool.query(
          "UPDATE p2p_trades SET status = 'expired', updated_at = NOW() WHERE id = $1",
          [trade.id]
        );

        // Create notifications (non-blocking)
        (async () => {
          try {
            await createP2PNotification(
              trade.buyer_id,
              'cancelled',
              'Trade Expired',
              `Your P2P trade expired due to non-payment. The offer has been returned to the seller.`,
              { trade_id: trade.id }
            );

            await createP2PNotification(
              trade.seller_id,
              'cancelled',
              'Trade Expired',
              `Your P2P trade expired due to buyer non-payment. Escrow has been released back to your wallet.`,
              { trade_id: trade.id }
            );
          } catch (err) {
            console.error('[P2P Cron] Error creating notifications:', err);
          }
        })();

        processedCount++;
        console.log(`[P2P Cron] Expired trade ${trade.id}`);
      } catch (err) {
        console.error(`[P2P Cron] Error expiring trade ${trade.id}:`, err);
      }
    }

    console.log(`[P2P Cron] Trade expiry check complete. Processed: ${processedCount}`);
    return processedCount;
  } catch (error) {
    console.error("[P2P Cron] Fatal error in expireOverdueTrades:", error);
    return 0;
  }
}
