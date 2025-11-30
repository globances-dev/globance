import { Router, Request, Response } from 'express';
import { supabase } from "../utils/supabase";
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

    // Get deposits
    const { data: deposits, error: depositError } = await supabase
      .from('deposits')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (depositError) {
      throw depositError;
    }

    (deposits || []).forEach((d: any) => {
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
    const { data: withdrawals, error: withdrawalError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (withdrawalError) {
      throw withdrawalError;
    }

    (withdrawals || []).forEach((w: any) => {
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
    const { data: purchases, error: purchaseError } = await supabase
      .from('purchases')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (purchaseError) {
      throw purchaseError;
    }

    const packageIds = Array.from(new Set((purchases || []).map((p) => p.package_id)));
    let packageNameMap: Record<string, string> = {};
    if (packageIds.length > 0) {
      const { data: packageRows } = await supabase
        .from('packages')
        .select('id, name')
        .in('id', packageIds);
      packageNameMap = Object.fromEntries((packageRows || []).map((pkg) => [pkg.id, pkg.name]));
    }

    (purchases || []).forEach((p: any) => {
      activities.push({
        id: `purchase_${p.id}`,
        type: 'package',
        title: 'Package Purchased',
        amount: p.amount,
        packageName: packageNameMap[p.package_id] || p.package_id,
        status: 'success',
        timestamp: p.created_at,
      });
    });

    // Get mining earnings transactions
    const { data: earnings, error: earningsError } = await supabase
      .from('earnings_transactions')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('type', 'daily_mining_income')
      .gt('amount', 0)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (earningsError) {
      throw earningsError;
    }

    (earnings || []).forEach((e: any) => {
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
    const { data: referralBonuses, error: referralError } = await supabase
      .from('referral_bonus_transactions')
      .select('*')
      .eq('recipient_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (referralError) {
      throw referralError;
    }

    (referralBonuses || []).forEach((r: any) => {
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
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Get mining earnings for today
    const { data: earningRows, error: earningError } = await supabase
      .from('earnings_transactions')
      .select('amount, created_at')
      .eq('user_id', req.user.id)
      .eq('type', 'daily_mining_income')
      .gte('created_at', todayISO);

    if (earningError) {
      throw earningError;
    }

    const miningTotal = (earningRows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);

    // Get referral earnings for today
    const { data: referralRows, error: todayReferralError } = await supabase
      .from('referral_bonus_transactions')
      .select('amount, created_at')
      .eq('recipient_id', req.user.id)
      .gte('created_at', todayISO);

    if (todayReferralError) {
      throw todayReferralError;
    }

    const referralTotal = (referralRows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);

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
