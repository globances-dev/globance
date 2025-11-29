import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { verifyToken } from '../utils/jwt';
import { getMinimumUSDT } from '../utils/nowpayments';
import { sendWithdrawalNotificationEmail } from '../utils/email';
import { supabase } from '../utils/supabase';

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

const adminMiddleware = async (req: any, res: Response, next: Function) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', decoded.id)
      .single();

    if (error) {
      throw error;
    }

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = decoded;
    next();
  } catch (err: any) {
    console.error('[Withdrawals] Admin middleware error:', err.message);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

router.get('/', authMiddleware, async (req: any, res: Response) => {
  try {
    const { data: withdrawals, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ withdrawals: withdrawals || [] });
  } catch (err: any) {
    console.error('[Withdrawals] History error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.post('/', authMiddleware, async (req: any, res: Response) => {
  try {
    const { amount, address, network } = z
      .object({
        amount: z.number().positive(),
        address: z.string().min(10),
        network: z.enum(['TRC20', 'BEP20']),
      })
      .parse(req.body);

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('is_frozen')
      .eq('id', req.user.id)
      .single();

    if (userError) {
      throw userError;
    }

    if (userRow?.is_frozen) {
      return res.status(403).json({ error: 'Account is frozen. Withdrawals are disabled.' });
    }

    if (network === 'TRC20') {
      if (!address.startsWith('T')) {
        return res.status(400).json({ error: 'TRC20 address must start with "T"' });
      }
      if (address.length !== 34) {
        return res.status(400).json({ error: `TRC20 address must be exactly 34 characters. You provided ${address.length} characters.` });
      }
    } else if (network === 'BEP20') {
      if (!address.startsWith('0x')) {
        return res.status(400).json({ error: 'BEP20 address must start with "0x"' });
      }
      if (address.length !== 42) {
        return res.status(400).json({ error: `BEP20 address must be exactly 42 characters. You provided ${address.length} characters.` });
      }
    }

    const MIN_WITHDRAWAL = getMinimumUSDT();
    if (amount < MIN_WITHDRAWAL) {
      return res.status(400).json({ error: `Minimum withdrawal amount is ${MIN_WITHDRAWAL} USDT.` });
    }

    const WITHDRAWAL_FEE = 1;
    const netAmount = amount - WITHDRAWAL_FEE;

    const { data: walletRows, error: walletError } = await supabase
      .from('wallets')
      .select('usdt_balance')
      .eq('user_id', req.user.id)
      .single();

    if (walletError) {
      throw walletError;
    }

    if (!walletRows) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    if (walletRows.usdt_balance < amount) {
      return res.status(400).json({ error: `Insufficient balance. Available: ${walletRows.usdt_balance} USDT` });
    }

    const withdrawalId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const { data: insertData, error: insertError } = await supabase
      .from('withdrawals')
      .insert({
        id: withdrawalId,
        user_id: req.user.id,
        amount_usdt: amount,
        fee_usdt: WITHDRAWAL_FEE,
        net_amount_usdt: netAmount,
        address,
        network,
        status: 'pending',
        created_at: timestamp,
      })
      .select('*')
      .single();

    if (insertError) {
      throw insertError;
    }

    const newBalance = walletRows.usdt_balance - amount;
    const { error: walletUpdateError } = await supabase
      .from('wallets')
      .update({ usdt_balance: newBalance })
      .eq('user_id', req.user.id);

    if (walletUpdateError) {
      await supabase.from('withdrawals').delete().eq('id', withdrawalId);
      throw walletUpdateError;
    }

    res.json({
      success: true,
      message: 'Withdrawal request submitted. Awaiting admin approval.',
      withdrawal: {
        id: withdrawalId,
        amount,
        fee_usdt: WITHDRAWAL_FEE,
        net_amount_usdt: netAmount,
        status: 'pending',
        network,
        address,
        created_at: insertData.created_at,
      },
    });
  } catch (err: any) {
    console.error('[Withdrawals] Create error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.get('/admin', adminMiddleware, async (_req: any, res: Response) => {
  try {
    const { data: withdrawals, error } = await supabase
      .from('withdrawals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ withdrawals: withdrawals || [] });
  } catch (err: any) {
    console.error('[Withdrawals] Admin list error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/complete', adminMiddleware, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { data: withdrawal, error: fetchError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', id)
      .eq('status', 'pending')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found or already processed' });
    }

    const { error: updateError } = await supabase
      .from('withdrawals')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    await supabase.from('audit_logs').insert({
      admin_id: req.user.id,
      action: 'withdrawal_approved',
      resource_type: 'withdrawal',
      resource_id: id,
      details: { withdrawal_id: id },
      created_at: new Date().toISOString(),
    });

    try {
      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('id', withdrawal.user_id)
        .single();

      if (!userError && userRow?.email) {
        await sendWithdrawalNotificationEmail(
          userRow.email,
          withdrawal.net_amount_usdt || withdrawal.amount_usdt,
          'completed'
        );
      }
    } catch (emailError) {
      console.error('[Withdrawals] Email error:', emailError);
    }

    res.json({ success: true, message: 'Withdrawal approved' });
  } catch (err: any) {
    console.error('[Withdrawals] Complete error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/reject', adminMiddleware, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason || 'Rejected by admin';

    const { data: withdrawal, error: fetchError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', id)
      .eq('status', 'pending')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found or already processed' });
    }

    const { data: walletRow, error: walletFetchError } = await supabase
      .from('wallets')
      .select('usdt_balance')
      .eq('user_id', withdrawal.user_id)
      .single();

    if (walletFetchError) {
      throw walletFetchError;
    }

    const refundBalance = (walletRow?.usdt_balance || 0) + withdrawal.amount_usdt;

    const { error: refundError } = await supabase
      .from('wallets')
      .update({ usdt_balance: refundBalance })
      .eq('user_id', withdrawal.user_id);

    if (refundError) {
      throw refundError;
    }

    const { error: statusError } = await supabase
      .from('withdrawals')
      .update({ status: 'rejected', admin_notes: reason, processed_at: new Date().toISOString() })
      .eq('id', id);

    if (statusError) {
      throw statusError;
    }

    await supabase.from('audit_logs').insert({
      admin_id: req.user.id,
      action: 'withdrawal_rejected',
      resource_type: 'withdrawal',
      resource_id: id,
      details: { reason },
      created_at: new Date().toISOString(),
    });

    try {
      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('id', withdrawal.user_id)
        .single();

      if (!userError && userRow?.email) {
        await sendWithdrawalNotificationEmail(userRow.email, withdrawal.amount_usdt, 'rejected');
      }
    } catch (emailError) {
      console.error('[Withdrawals] Email error:', emailError);
    }

    res.json({ success: true, message: 'Withdrawal rejected and refunded' });
  } catch (err: any) {
    console.error('[Withdrawals] Reject error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

export default router;
