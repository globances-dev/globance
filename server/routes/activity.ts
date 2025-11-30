import { Router, Request, Response } from 'express';
import { getSupabasePool } from '../utils/supabase';
import { verifyToken } from '../utils/jwt';

const router = Router();

const authMiddleware = (req: any, res: Response, next: Function) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.user = decoded;
  next();
};

// Get user activity feed (deposits, withdrawals, packages, earnings)
router.get('/feed', authMiddleware, async (req: any, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20'), 100);
    const activities: any[] = [];
    const pool = getSupabasePool();

    // Get deposits
    const depositsResult = await pool.query(
      'SELECT * FROM deposits WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [req.user.id, limit]
    );

    (depositsResult.rows || []).forEach((d: any) => {
      if (d.status === 'confirmed') {
        activities.push({
          id: `deposit_${d.id}`,
          type: 'deposit',
          title: 'Deposit Received',
          amount: d.amount,
          network: d.network,
          status: 'success',
          timestamp: d.created_at,
        });
      }
    });

    // Get withdrawals
    const withdrawalsResult = await pool.query(
      'SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [req.user.id, limit]
    );

    (withdrawalsResult.rows || []).forEach((w: any) => {
      activities.push({
        id: `withdrawal_${w.id}`,
        type: 'withdrawal',
        title: w.status === 'completed' ? 'Withdrawal Completed' : 'Withdrawal Pending',
        amount: w.net_amount_usdt || (w.amount_usdt - (w.fee_usdt || 0)),
        fee: w.fee_usdt,
        network: w.network,
        status: w.status,
        timestamp: w.created_at,
      });
    });

    // Get package purchases
    const purchasesResult = await pool.query(
      `SELECT p.*, pkg.name FROM purchases p
       LEFT JOIN packages pkg ON p.package_id = pkg.id
       WHERE p.user_id = $1 ORDER BY p.created_at DESC LIMIT $2`,
      [req.user.id, limit]
    );

    (purchasesResult.rows || []).forEach((p: any) => {
      activities.push({
        id: `purchase_${p.id}`,
        type: 'package',
        title: 'Package Purchased',
        amount: p.amount,
        packageName: p.name,
        status: 'success',
        timestamp: p.created_at,
      });
    });

    // Get mining earnings transactions
    const earningsResult = await pool.query(
      `SELECT * FROM earnings_transactions WHERE user_id = $1 AND type = 'daily_mining_income' AND amount > 0
       ORDER BY created_at DESC LIMIT $2`,
      [req.user.id, limit]
    );

    (earningsResult.rows || []).forEach((e: any) => {
      activities.push({
        id: `earning_${e.id}`,
        type: 'mining',
        title: 'Mining Reward',
        amount: e.amount,
        status: 'success',
        timestamp: e.created_at,
      });
    });

    // Get referral bonuses
    const referralsResult = await pool.query(
      `SELECT * FROM referral_bonus_transactions WHERE recipient_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [req.user.id, limit]
    );

    (referralsResult.rows || []).forEach((r: any) => {
      activities.push({
        id: `referral_${r.id}`,
        type: 'referral',
        title: `Referral Bonus (Level ${r.level})`,
        amount: r.amount,
        status: 'success',
        timestamp: r.created_at,
      });
    });

    // Sort by timestamp descending and limit
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const limited = activities.slice(0, limit);

    res.json({ activities: limited });
  } catch (error: any) {
    console.error('Error fetching activity feed:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get today's earnings only
router.get('/today-earnings', authMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getSupabasePool();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Get mining earnings for today
    const earningsResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM earnings_transactions
       WHERE user_id = $1 AND created_at >= $2 AND type = 'daily_mining_income'`,
      [req.user.id, todayISO]
    );

    const miningTotal = parseFloat(earningsResult.rows[0].total || 0);

    // Get referral earnings for today
    const referralsResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM referral_bonus_transactions
       WHERE recipient_id = $1 AND created_at >= $2`,
      [req.user.id, todayISO]
    );

    const referralTotal = parseFloat(referralsResult.rows[0].total || 0);

    res.json({
      mining_earnings: miningTotal,
      referral_earnings: referralTotal,
      total_today: miningTotal + referralTotal,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
