import { Router, Request, Response } from 'express';
import { verifyToken } from '../utils/jwt';
import { createPermanentDepositAddress, getMinimumUSDT } from '../utils/nowpayments';
import { sendWithdrawalNotificationEmail } from '../utils/email';
import { z } from 'zod';
import { supabase } from "../utils/supabase";

const router = Router();

// Middleware to verify auth
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

// Get complete wallet data (balance + total earned)
router.get('/me', authMiddleware, async (req: any, res: Response) => {
  try {
    const { data: walletRows, error: walletError } = await supabase
      .from('wallets')
      .select('usdt_balance, escrow_balance')
      .eq('user_id', req.user.id);

    if (walletError) {
      throw walletError;
    }

    if (!walletRows || walletRows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const wallet = walletRows[0];

    // Calculate total earned from all purchases
    const { data: purchasesRows, error: purchasesError } = await supabase
      .from('purchases')
      .select('total_earned')
      .eq('user_id', req.user.id);

    if (purchasesError) {
      throw purchasesError;
    }

    const total_earned = (purchasesRows || []).reduce((sum: number, p: any) => sum + (p.total_earned || 0), 0);

    res.json({
      usdt_balance: wallet.usdt_balance,
      escrow_balance: wallet.escrow_balance || 0,
      total_earned,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get wallet balance (legacy endpoint - kept for backward compatibility)
router.get('/balance', authMiddleware, async (req: any, res: Response) => {
  try {
    const { data: walletRows, error: walletError } = await supabase
      .from('wallets')
      .select('usdt_balance, escrow_balance')
      .eq('user_id', req.user.id);

    if (walletError) {
      throw walletError;
    }

    if (!walletRows || walletRows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const wallet = walletRows[0];
    res.json({
      usdt_balance: wallet.usdt_balance,
      escrow_balance: wallet.escrow_balance || 0,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get or create deposit addresses (PERMANENT - created once per user)
router.get('/deposit-addresses', authMiddleware, async (req: any, res: Response) => {
  try {
    const { data: addresses, error: addressesError } = await supabase
      .from('deposit_addresses')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (addressesError) {
      throw addressesError;
    }

    const existingAddresses = addresses || [];
    const trc20 = existingAddresses.find((a: any) => a.network === 'TRC20');
    const bep20 = existingAddresses.find((a: any) => a.network === 'BEP20');

    // Create permanent addresses if they don't exist (fallback from registration)
    if (!trc20) {
      try {
        const trc20Address = await createPermanentDepositAddress(req.user.id, 'TRC20');
        await supabase.from('deposit_addresses').insert({
          user_id: req.user.id,
          network: 'TRC20',
          address: trc20Address.address,
          provider: 'nowpayments',
          provider_wallet_id: trc20Address.paymentId,
          is_active: true,
          created_at: new Date().toISOString(),
        });
        console.log(`[NOWPayments] Created TRC20 address ${trc20Address.address}`);
      } catch (err) {
        console.error('[NOWPayments] Error creating TRC20 address:', err);
      }
    }

    if (!bep20) {
      try {
        const bep20Address = await createPermanentDepositAddress(req.user.id, 'BEP20');
        await supabase.from('deposit_addresses').insert({
          user_id: req.user.id,
          network: 'BEP20',
          address: bep20Address.address,
          provider: 'nowpayments',
          provider_wallet_id: bep20Address.paymentId,
          is_active: true,
          created_at: new Date().toISOString(),
        });
        console.log(`[NOWPayments] Created BEP20 address ${bep20Address.address}`);
      } catch (err) {
        console.error('[NOWPayments] Error creating BEP20 address:', err);
      }
    }

    // Get final permanent addresses
    const { data: finalAddresses, error: finalError } = await supabase
      .from('deposit_addresses')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (finalError) {
      throw finalError;
    }

    res.json({
      addresses: finalAddresses || [],
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get deposit history
router.get('/deposit-history', authMiddleware, async (req: any, res: Response) => {
  try {
    const { data: deposits, error } = await supabase
      .from('deposits')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    res.json({
      deposits: deposits || [],
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Deprecated: Use /withdraw instead (auto-executes with NOWPayments)
// Kept for backward compatibility - redirects to new endpoint
router.post('/withdrawal-request', authMiddleware, async (req: any, res: Response) => {
  console.warn('[Deprecated] withdrawal-request endpoint called - use /withdraw instead');
  return res.status(400).json({ 
    error: 'This endpoint is deprecated. Use POST /api/wallet/withdraw instead, which auto-executes with the correct 1 USDT fee.' 
  });
});

// Get withdrawal history
router.get('/withdrawal-history', authMiddleware, async (req: any, res: Response) => {
  try {
    const { data: withdrawals, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    // Ensure net_amount is included
    const withdrawalsWithNetAmount = (withdrawals || []).map((w: any) => ({
      ...w,
      net_amount: w.net_amount_usdt !== undefined ? w.net_amount_usdt : (w.amount_usdt - (w.fee_usdt || 0)),
    }));

    res.json({
      withdrawals: withdrawalsWithNetAmount,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Manual withdrawal (creates pending request, no external API calls)
router.post('/withdraw', authMiddleware, async (req: any, res: Response) => {
  try {
    const { amount, address, network } = z
      .object({
        amount: z.number().positive(),
        address: z.string().min(10),
        network: z.enum(['TRC20', 'BEP20']),
      })
      .parse(req.body);

    console.log(`[Withdrawal] Manual withdrawal request from user ${req.user.id}: ${amount} USDT to ${address} on ${network}`);

    // Validate address format based on network
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

    // Validate minimum withdrawal (10 USDT)
    const MIN_WITHDRAWAL = getMinimumUSDT();
    if (amount < MIN_WITHDRAWAL) {
      return res.status(400).json({ 
        error: `Minimum withdrawal amount is ${MIN_WITHDRAWAL} USDT.` 
      });
    }

    // Fixed 1 USDT fee
    const WITHDRAWAL_FEE = 1;
    const netAmount = amount - WITHDRAWAL_FEE;

    // Check user balance
    const { data: walletRows, error: walletError } = await supabase
      .from('wallets')
      .select('usdt_balance')
      .eq('user_id', req.user.id);

    if (walletError) {
      throw walletError;
    }

    if (!walletRows || walletRows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const wallet = walletRows[0];
    if (wallet.usdt_balance < amount) {
      return res.status(400).json({
        error: `Insufficient balance. Available: ${wallet.usdt_balance} USDT`
      });
    }

    // Create withdrawal record using direct PostgreSQL
    console.log(`[Withdrawal] Creating withdrawal via direct SQL: ${amount} USDT to ${address}`);

    let withdrawal;
    try {
      const timestamp = new Date().toISOString();
      const { data, error } = await supabase
        .from('withdrawals')
        .insert({
          user_id: req.user.id,
          amount_usdt: amount,
          fee_usdt: WITHDRAWAL_FEE,
          net_amount_usdt: netAmount,
          address,
          network,
          status: 'pending',
          created_at: timestamp,
          updated_at: timestamp,
        })
        .select('id, user_id, amount_usdt, fee_usdt, net_amount_usdt, address, network, status, created_at, updated_at')
        .single();

      if (error) {
        throw error;
      }

      withdrawal = data;
      console.log('[Withdrawal] Successfully created withdrawal record:', withdrawal.id);
    } catch (err: any) {
      console.error('[Withdrawal] Direct SQL insert failed:', err);
      return res.status(400).json({ error: `Failed to create withdrawal: ${err.message}` });
    }

    // Deduct full amount from user wallet immediately
    try {
      const { error: updateError, data: updateData } = await supabase
        .from('wallets')
        .update({ usdt_balance: wallet.usdt_balance - amount })
        .eq('user_id', req.user.id)
        .select('user_id');

      if (updateError) {
        throw updateError;
      }

      if (!updateData || updateData.length === 0) {
        throw new Error('Wallet update failed - no rows affected');
      }

      console.log('[Withdrawal] Wallet updated - balance deducted');
    } catch (err: any) {
      console.error('[Withdrawal] Failed to update wallet:', err.message);
      // Delete withdrawal record if wallet update fails
      await supabase.from('withdrawals').delete().eq('id', withdrawal.id);
      return res.status(500).json({ error: 'Failed to process withdrawal' });
    }

    // Record platform fee (1 USDT)
    try {
      await supabase.from('platform_earnings').insert({
        source_type: 'withdrawal_fee',
        source_id: withdrawal.id,
        amount: WITHDRAWAL_FEE,
        description: `Withdrawal fee from user ${req.user.id}`,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Withdrawal] Failed to record platform fee:', err);
    }

    console.log(`[Withdrawal] Created pending withdrawal ${withdrawal.id} - awaiting admin approval`);

    res.json({
      success: true,
      message: 'Withdrawal request submitted. Awaiting admin approval.',
      withdrawal: {
        id: withdrawal.id,
        amount,
        fee_usdt: WITHDRAWAL_FEE,
        net_amount_usdt: netAmount,
        status: 'pending',
        network,
        address,
        created_at: withdrawal.created_at,
      },
    });

  } catch (error: any) {
    console.error('[Withdrawal] Error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
