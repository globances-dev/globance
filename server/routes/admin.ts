import { Router, Request, Response } from "express";
import { getSupabaseQueryClient } from "../utils/supabase";
import { verifyToken } from "../utils/jwt";
import { sendWithdrawalNotificationEmail } from "../utils/email";
import { z } from "zod";
import {
  getUserRankInfo,
  updateUserRank,
  countActiveDirectReferrals,
} from "../utils/referral";

const router = Router();

// Middleware - admin only
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
    const pool = getSupabaseQueryClient();
    const result = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [decoded.id]
    );

    if (!result.rows.length || result.rows[0].role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    req.user = decoded;
    next();
  } catch (error: any) {
    console.error("[Admin] Middleware error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
};

// Get all users
router.get("/users", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { search, role } = req.query;
    const pool = getSupabaseQueryClient();

    let query = `
      SELECT u.*, w.usdt_balance 
      FROM users u 
      LEFT JOIN wallets w ON u.id = w.user_id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (search) {
      conditions.push(`(u.email ILIKE $${params.length + 1} OR u.username ILIKE $${params.length + 1} OR u.full_name ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    if (role) {
      conditions.push(`u.role = $${params.length + 1}`);
      params.push(role);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY u.created_at DESC";

    const result = await pool.query(query, params);
    res.json({ users: result.rows || [] });
  } catch (error: any) {
    console.error("[Admin] Get users error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Freeze/unfreeze user account
router.post(
  "/users/:user_id/freeze",
  adminMiddleware,
  async (req: any, res: Response) => {
    try {
      const { is_frozen } = z
        .object({ is_frozen: z.boolean() })
        .parse(req.body);

      const pool = getSupabaseQueryClient();

      const result = await pool.query(
        "UPDATE users SET is_frozen = $1 WHERE id = $2 RETURNING *",
        [is_frozen, req.params.user_id]
      );

      // Log to audit
      await pool.query(
        `INSERT INTO audit_logs (admin_id, action, resource_type, resource_id)
         VALUES ($1, $2, $3, $4)`,
        [req.user.id, is_frozen ? "account_frozen" : "account_unfrozen", "user", req.params.user_id]
      );

      res.json({ success: true, user: result.rows[0] });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Change user role
router.post(
  "/users/:user_id/role",
  adminMiddleware,
  async (req: any, res: Response) => {
    try {
      const { role } = z
        .object({ role: z.enum(["user", "admin"]) })
        .parse(req.body);

      const pool = getSupabaseQueryClient();

      const result = await pool.query(
        "UPDATE users SET role = $1 WHERE id = $2 RETURNING *",
        [role, req.params.user_id]
      );

      // Log to audit
      await pool.query(
        `INSERT INTO audit_logs (admin_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, "role_changed", "user", req.params.user_id, JSON.stringify({ new_role: role })]
      );

      res.json({ success: true, user: result.rows[0] });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Get dashboard analytics
router.get("/analytics", adminMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getSupabaseQueryClient();

    // Total users
    const usersResult = await pool.query("SELECT COUNT(*) as count FROM users");
    const totalUsers = parseInt(usersResult.rows[0].count) || 0;

    // Active miners (active packages count)
    const activeMinersResult = await pool.query(
      "SELECT COUNT(*) as count FROM purchases WHERE status = 'active'"
    );
    const activeMiners = parseInt(activeMinersResult.rows[0].count) || 0;

    // Deposits - last 24h and 7d
    const deposits24hResult = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM deposits WHERE status = 'completed' AND created_at > NOW() - INTERVAL '24 hours'"
    );
    const deposits7dResult = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM deposits WHERE status = 'completed' AND created_at > NOW() - INTERVAL '7 days'"
    );
    const deposits = {
      last24h: parseFloat(deposits24hResult.rows[0].total) || 0,
      last7d: parseFloat(deposits7dResult.rows[0].total) || 0
    };

    // Withdrawals - last 24h and 7d
    const withdrawals24hResult = await pool.query(
      "SELECT COALESCE(SUM(amount_usdt), 0) as total FROM withdrawals WHERE status = 'completed' AND created_at > NOW() - INTERVAL '24 hours'"
    );
    const withdrawals7dResult = await pool.query(
      "SELECT COALESCE(SUM(amount_usdt), 0) as total FROM withdrawals WHERE status = 'completed' AND created_at > NOW() - INTERVAL '7 days'"
    );
    const withdrawals = {
      last24h: parseFloat(withdrawals24hResult.rows[0].total) || 0,
      last7d: parseFloat(withdrawals7dResult.rows[0].total) || 0
    };

    // Mining payouts - last 24h and 7d
    const payouts24hResult = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM earnings_transactions WHERE type = 'daily_mining_income' AND created_at > NOW() - INTERVAL '24 hours'"
    );
    const payouts7dResult = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM earnings_transactions WHERE type = 'daily_mining_income' AND created_at > NOW() - INTERVAL '7 days'"
    );
    const miningPayouts = {
      last24h: parseFloat(payouts24hResult.rows[0].total) || 0,
      last7d: parseFloat(payouts7dResult.rows[0].total) || 0
    };

    // Referral rewards total
    const referralResult = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM referral_bonus_transactions"
    );
    const referralRewards = parseFloat(referralResult.rows[0].total) || 0;

    // P2P trades stats
    const activeTradesResult = await pool.query(
      "SELECT COUNT(*) as count FROM p2p_trades WHERE status IN ('pending', 'paid')"
    );
    const completedTradesResult = await pool.query(
      "SELECT COUNT(*) as count FROM p2p_trades WHERE status = 'completed'"
    );
    const disputedTradesResult = await pool.query(
      "SELECT COUNT(*) as count FROM p2p_trades WHERE status = 'disputed'"
    );
    const p2p = {
      activeTrades: parseInt(activeTradesResult.rows[0].count) || 0,
      completedTrades: parseInt(completedTradesResult.rows[0].count) || 0,
      disputedTrades: parseInt(disputedTradesResult.rows[0].count) || 0
    };

    res.json({
      totalUsers,
      activeMiners,
      deposits,
      withdrawals,
      miningPayouts,
      referralRewards,
      p2p
    });
  } catch (error: any) {
    console.error("[Admin] Analytics error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Get all withdrawals for admin
router.get("/withdrawals", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { status } = req.query;
    const pool = getSupabaseQueryClient();

    let query = `
      SELECT w.*, u.email, u.username, u.full_name
      FROM withdrawals w
      JOIN users u ON w.user_id = u.id
    `;
    const params: any[] = [];

    if (status) {
      query += " WHERE w.status = $1";
      params.push(status);
    }

    query += " ORDER BY w.created_at DESC";

    const result = await pool.query(query, params);
    res.json({ withdrawals: result.rows || [] });
  } catch (error: any) {
    console.error("[Admin] Get withdrawals error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Approve/complete withdrawal
router.post(
  "/withdrawals/:id/complete",
  adminMiddleware,
  async (req: any, res: Response) => {
    try {
      const pool = getSupabaseQueryClient();

      // Get withdrawal
      const withdrawalResult = await pool.query(
        "SELECT * FROM withdrawals WHERE id = $1 AND status = 'pending'",
        [req.params.id]
      );

      if (!withdrawalResult.rows.length) {
        return res.status(404).json({ error: "Withdrawal not found or already processed" });
      }

      const withdrawal = withdrawalResult.rows[0];

      // Update withdrawal status - only use columns that exist in production
      await pool.query(
        `UPDATE withdrawals 
         SET status = 'completed', updated_at = NOW()
         WHERE id = $1`,
        [req.params.id]
      );

      // Log to audit
      await pool.query(
        `INSERT INTO audit_logs (admin_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, "withdrawal_approved", "withdrawal", req.params.id, JSON.stringify({ withdrawal_id: req.params.id })]
      );

      // Send notification email
      try {
        const userResult = await pool.query("SELECT email FROM users WHERE id = $1", [withdrawal.user_id]);
        if (userResult.rows.length) {
          await sendWithdrawalNotificationEmail(
            userResult.rows[0].email,
            withdrawal.net_amount_usdt || withdrawal.amount_usdt,
            "completed"
          );
        }
      } catch (emailError) {
        console.error("[Admin] Email error:", emailError);
      }

      res.json({ success: true, message: "Withdrawal approved" });
    } catch (error: any) {
      console.error("[Admin] Complete withdrawal error:", error);
      res.status(400).json({ error: error.message });
    }
  }
);

// Reject withdrawal
router.post(
  "/withdrawals/:id/reject",
  adminMiddleware,
  async (req: any, res: Response) => {
    try {
      const reason = req.body?.reason || "Rejected by admin";
      const pool = getSupabaseQueryClient();

      // Get withdrawal
      const withdrawalResult = await pool.query(
        "SELECT * FROM withdrawals WHERE id = $1 AND status = 'pending'",
        [req.params.id]
      );

      if (!withdrawalResult.rows.length) {
        return res.status(404).json({ error: "Withdrawal not found or already processed" });
      }

      const withdrawal = withdrawalResult.rows[0];

      // Refund to wallet (full amount including fee)
      await pool.query(
        "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
        [withdrawal.amount_usdt, withdrawal.user_id]
      );

      // Update withdrawal status
      await pool.query(
        `UPDATE withdrawals 
         SET status = 'rejected', admin_notes = $1, processed_at = NOW()
         WHERE id = $2`,
        [reason, req.params.id]
      );

      // Log to audit
      await pool.query(
        `INSERT INTO audit_logs (admin_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, "withdrawal_rejected", "withdrawal", req.params.id, JSON.stringify({ reason })]
      );

      // Send notification email
      try {
        const userResult = await pool.query("SELECT email FROM users WHERE id = $1", [withdrawal.user_id]);
        if (userResult.rows.length) {
          await sendWithdrawalNotificationEmail(
            userResult.rows[0].email,
            withdrawal.amount_usdt,
            "rejected"
          );
        }
      } catch (emailError) {
        console.error("[Admin] Email error:", emailError);
      }

      res.json({ success: true, message: "Withdrawal rejected and refunded" });
    } catch (error: any) {
      console.error("[Admin] Reject withdrawal error:", error);
      res.status(400).json({ error: error.message });
    }
  }
);

// Get all deposits
router.get("/deposits", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { status } = req.query;
    const pool = getSupabaseQueryClient();

    let query = `
      SELECT d.*, u.email, u.username, u.full_name
      FROM deposits d
      JOIN users u ON d.user_id = u.id
    `;
    const params: any[] = [];

    if (status) {
      query += " WHERE d.status = $1";
      params.push(status);
    }

    query += " ORDER BY d.created_at DESC";

    const result = await pool.query(query, params);
    res.json({ deposits: result.rows || [] });
  } catch (error: any) {
    console.error("[Admin] Get deposits error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Get all purchases (mining)
router.get("/purchases", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { status } = req.query;
    const pool = getSupabaseQueryClient();

    let query = `
      SELECT p.*, u.email, u.username, u.full_name, pkg.name as package_name
      FROM purchases p
      JOIN users u ON p.user_id = u.id
      JOIN packages pkg ON p.package_id = pkg.id
    `;
    const params: any[] = [];

    if (status) {
      query += " WHERE p.status = $1";
      params.push(status);
    }

    query += " ORDER BY p.created_at DESC";

    const result = await pool.query(query, params);
    res.json({ purchases: result.rows || [] });
  } catch (error: any) {
    console.error("[Admin] Get purchases error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Get referral stats
router.get("/referrals", adminMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getSupabaseQueryClient();

    // Top referrers
    const topReferrersResult = await pool.query(`
      SELECT u.id, u.email, u.username, u.full_name, u.current_rank,
             COUNT(r.id) as referral_count,
             COALESCE(SUM(rbt.amount), 0) as total_earned
      FROM users u
      LEFT JOIN referrals r ON u.id = r.referrer_id
      LEFT JOIN referral_bonus_transactions rbt ON u.id = rbt.to_user_id
      GROUP BY u.id
      HAVING COUNT(r.id) > 0
      ORDER BY referral_count DESC
      LIMIT 20
    `);

    // Total referral bonuses paid
    const bonusResult = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM referral_bonus_transactions"
    );

    res.json({
      topReferrers: topReferrersResult.rows || [],
      totalBonusesPaid: parseFloat(bonusResult.rows[0].total) || 0
    });
  } catch (error: any) {
    console.error("[Admin] Get referrals error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Get audit logs
router.get("/audit-logs", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { limit = 100 } = req.query;
    const pool = getSupabaseQueryClient();

    const result = await pool.query(`
      SELECT al.*, u.email as admin_email
      FROM audit_logs al
      LEFT JOIN users u ON al.admin_id = u.id
      ORDER BY al.created_at DESC
      LIMIT $1
    `, [parseInt(limit as string) || 100]);

    res.json({ logs: result.rows || [] });
  } catch (error: any) {
    console.error("[Admin] Get audit logs error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Get cron logs
router.get("/cron-logs", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { limit = 30 } = req.query;
    const pool = getSupabaseQueryClient();

    const result = await pool.query(`
      SELECT * FROM cron_logs
      ORDER BY created_at DESC
      LIMIT $1
    `, [parseInt(limit as string) || 30]);

    res.json({ logs: result.rows || [] });
  } catch (error: any) {
    console.error("[Admin] Get cron logs error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Get/update settings
router.get("/settings", adminMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getSupabaseQueryClient();
    const result = await pool.query("SELECT * FROM settings ORDER BY category, key");
    res.json({ settings: result.rows || [] });
  } catch (error: any) {
    console.error("[Admin] Get settings error:", error);
    res.status(400).json({ error: error.message });
  }
});

router.post("/settings", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { category, key, value } = z
      .object({
        category: z.string(),
        key: z.string(),
        value: z.string(),
      })
      .parse(req.body);

    const pool = getSupabaseQueryClient();

    await pool.query(`
      INSERT INTO settings (category, key, value)
      VALUES ($1, $2, $3)
      ON CONFLICT (category, key) DO UPDATE SET value = $3, updated_at = NOW()
    `, [category, key, value]);

    // Log to audit
    await pool.query(
      `INSERT INTO audit_logs (admin_id, action, resource_type, details)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, "setting_updated", "settings", JSON.stringify({ category, key, value })]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Admin] Update settings error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Update package
router.put("/packages/:id", adminMiddleware, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { name, min_investment, daily_percentage, duration_days, referral_required } = req.body;

    const pool = getSupabaseQueryClient();

    // Update package - use correct column names matching database schema
    await pool.query(`
      UPDATE packages 
      SET name = COALESCE($1, name),
          min_investment = COALESCE($2, min_investment),
          daily_percentage = COALESCE($3, daily_percentage),
          duration_days = COALESCE($4, duration_days),
          referral_required = COALESCE($5, referral_required)
      WHERE id = $6
    `, [name, min_investment, daily_percentage, duration_days, referral_required, id]);

    // Log to audit (skip resource_id since packages use integer IDs, not UUIDs)
    await pool.query(
      `INSERT INTO audit_logs (admin_id, action, resource_type, details)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, "package_updated", "packages", JSON.stringify({ package_id: id, name, min_investment, daily_percentage, duration_days, referral_required })]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Admin] Update package error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Get user details with full info
router.get("/users/:user_id", adminMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getSupabaseQueryClient();

    // Get user with wallet
    const userResult = await pool.query(`
      SELECT u.*, w.usdt_balance, w.escrow_balance, w.total_earned, w.total_referral_earned
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      WHERE u.id = $1
    `, [req.params.user_id]);

    if (!userResult.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResult.rows[0];

    // Get user's purchases
    const purchasesResult = await pool.query(`
      SELECT p.*, pkg.name as package_name
      FROM purchases p
      JOIN packages pkg ON p.package_id = pkg.id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
    `, [req.params.user_id]);

    // Get user's deposits
    const depositsResult = await pool.query(`
      SELECT * FROM deposits WHERE user_id = $1 ORDER BY created_at DESC
    `, [req.params.user_id]);

    // Get user's withdrawals
    const withdrawalsResult = await pool.query(`
      SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC
    `, [req.params.user_id]);

    // Get referral count
    const referralCount = await countActiveDirectReferrals(req.params.user_id);

    res.json({
      user,
      purchases: purchasesResult.rows || [],
      deposits: depositsResult.rows || [],
      withdrawals: withdrawalsResult.rows || [],
      referralCount
    });
  } catch (error: any) {
    console.error("[Admin] Get user details error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Adjust user balance
router.post(
  "/users/:user_id/balance",
  adminMiddleware,
  async (req: any, res: Response) => {
    try {
      const { amount, reason } = z
        .object({
          amount: z.number(),
          reason: z.string().min(1),
        })
        .parse(req.body);

      const pool = getSupabaseQueryClient();

      // Update wallet
      const result = await pool.query(
        `UPDATE wallets 
         SET usdt_balance = usdt_balance + $1 
         WHERE user_id = $2
         RETURNING usdt_balance`,
        [amount, req.params.user_id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: "User wallet not found" });
      }

      // Log to audit
      await pool.query(
        `INSERT INTO audit_logs (admin_id, user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.user.id,
          req.params.user_id,
          amount >= 0 ? "balance_added" : "balance_deducted",
          "wallet",
          req.params.user_id,
          JSON.stringify({ amount, reason, new_balance: result.rows[0].usdt_balance })
        ]
      );

      res.json({ 
        success: true, 
        newBalance: parseFloat(result.rows[0].usdt_balance)
      });
    } catch (error: any) {
      console.error("[Admin] Adjust balance error:", error);
      res.status(400).json({ error: error.message });
    }
  }
);

// Manually trigger daily mining cron
router.post("/trigger-mining-cron", adminMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getSupabaseQueryClient();
    const today = new Date().toISOString().split('T')[0];

    // Check if already run today
    const existingResult = await pool.query(
      "SELECT id FROM cron_logs WHERE process_type = 'daily_mining' AND process_date = $1",
      [today]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: "Daily mining already processed today" });
    }

    // Get active purchases
    const purchasesResult = await pool.query(`
      SELECT p.*, pkg.daily_percentage
      FROM purchases p
      JOIN packages pkg ON p.package_id = pkg.id
      WHERE p.status = 'active'
    `);

    let processed = 0;
    let totalDistributed = 0;
    let failed = 0;

    for (const purchase of purchasesResult.rows) {
      try {
        const dailyEarning = parseFloat(purchase.amount) * (parseFloat(purchase.daily_percentage) / 100);

        // Credit wallet
        await pool.query(
          "UPDATE wallets SET usdt_balance = usdt_balance + $1, total_earned = total_earned + $1 WHERE user_id = $2",
          [dailyEarning, purchase.user_id]
        );

        // Update purchase
        await pool.query(
          "UPDATE purchases SET total_earned = total_earned + $1, last_reward_date = NOW() WHERE id = $2",
          [dailyEarning, purchase.id]
        );

        // Record earnings
        await pool.query(
          `INSERT INTO earnings_transactions (user_id, purchase_id, amount, type)
           VALUES ($1, $2, $3, 'daily_mining')`,
          [purchase.user_id, purchase.id, dailyEarning]
        );

        // Record mining earning
        await pool.query(
          `INSERT INTO mining_earnings (user_id, purchase_id, amount, payout_date)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (purchase_id, payout_date) DO NOTHING`,
          [purchase.user_id, purchase.id, dailyEarning, today]
        );

        processed++;
        totalDistributed += dailyEarning;
      } catch (err) {
        failed++;
        console.error(`[Cron] Error processing purchase ${purchase.id}:`, err);
      }
    }

    // Log cron execution
    await pool.query(
      `INSERT INTO cron_logs (process_type, process_date, purchases_processed, total_distributed, failed_count)
       VALUES ('daily_mining', $1, $2, $3, $4)`,
      [today, processed, totalDistributed, failed]
    );

    // Log to audit
    await pool.query(
      `INSERT INTO audit_logs (admin_id, action, details)
       VALUES ($1, $2, $3)`,
      [req.user.id, "mining_cron_triggered", JSON.stringify({ processed, totalDistributed, failed })]
    );

    res.json({
      success: true,
      processed,
      totalDistributed,
      failed
    });
  } catch (error: any) {
    console.error("[Admin] Trigger mining cron error:", error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
