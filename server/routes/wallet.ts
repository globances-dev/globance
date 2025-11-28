import { Router, Request, Response } from 'express';
import { verifyToken } from '../utils/jwt';
import { createPermanentDepositAddress, getMinimumUSDT } from '../utils/nowpayments';
import { sendWithdrawalNotificationEmail } from '../utils/email';
import { z } from 'zod';
import { getPostgresPool } from '../utils/postgres.js';

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
    const pool = getPostgresPool();
    
    const walletResult = await pool.query(
      'SELECT * FROM wallets WHERE user_id = $1',
      [req.user.id]
    );

    if (!walletResult.rows || walletResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const wallet = walletResult.rows[0];

    // Calculate total earned from all purchases
    const purchasesResult = await pool.query(
      'SELECT total_earned FROM purchases WHERE user_id = $1',
      [req.user.id]
    );

    const total_earned = (purchasesResult.rows || []).reduce((sum: number, p: any) => sum + (p.total_earned || 0), 0);

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
    const pool = getPostgresPool();
    const result = await pool.query(
      'SELECT * FROM wallets WHERE user_id = $1',
      [req.user.id]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const wallet = result.rows[0];
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
    const pool = getPostgresPool();
    
    // Get existing permanent addresses
    const addressesResult = await pool.query(
      'SELECT * FROM deposit_addresses WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC',
      [req.user.id]
    );

    const addresses = addressesResult.rows || [];
    const trc20 = addresses.find((a: any) => a.network === 'TRC20');
    const bep20 = addresses.find((a: any) => a.network === 'BEP20');

    // Create permanent addresses if they don't exist (fallback from registration)
    if (!trc20) {
      try {
        const trc20Address = await createPermanentDepositAddress(req.user.id, 'TRC20');
        await pool.query(
          `INSERT INTO deposit_addresses (user_id, network, address, provider, provider_wallet_id, is_active)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [req.user.id, 'TRC20', trc20Address.address, 'nowpayments', trc20Address.paymentId]
        );
        console.log(`[NOWPayments] Created TRC20 address ${trc20Address.address}`);
      } catch (err) {
        console.error('[NOWPayments] Error creating TRC20 address:', err);
      }
    }

    if (!bep20) {
      try {
        const bep20Address = await createPermanentDepositAddress(req.user.id, 'BEP20');
        await pool.query(
          `INSERT INTO deposit_addresses (user_id, network, address, provider, provider_wallet_id, is_active)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [req.user.id, 'BEP20', bep20Address.address, 'nowpayments', bep20Address.paymentId]
        );
        console.log(`[NOWPayments] Created BEP20 address ${bep20Address.address}`);
      } catch (err) {
        console.error('[NOWPayments] Error creating BEP20 address:', err);
      }
    }

    // Get final permanent addresses
    const finalResult = await pool.query(
      'SELECT * FROM deposit_addresses WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json({
      addresses: finalResult.rows || [],
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get deposit history
router.get('/deposit-history', authMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getPostgresPool();
    const result = await pool.query(
      'SELECT * FROM deposits WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );

    res.json({
      deposits: result.rows || [],
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
    const pool = getPostgresPool();
    const result = await pool.query(
      'SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );

    // Ensure net_amount is included
    const withdrawalsWithNetAmount = (result.rows || []).map((w: any) => ({
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
    const pool = getPostgresPool();
    const walletResult = await pool.query(
      'SELECT usdt_balance FROM wallets WHERE user_id = $1',
      [req.user.id]
    );

    if (!walletResult.rows || walletResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const wallet = walletResult.rows[0];
    if (wallet.usdt_balance < amount) {
      return res.status(400).json({ 
        error: `Insufficient balance. Available: ${wallet.usdt_balance} USDT`
      });
    }

    // Create withdrawal record using direct PostgreSQL
    console.log(`[Withdrawal] Creating withdrawal via direct SQL: ${amount} USDT to ${address}`);

    let withdrawal;
    try {
      const result = await pool.query(
        `INSERT INTO withdrawals (user_id, amount_usdt, fee_usdt, net_amount_usdt, address, network, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, user_id, amount_usdt, fee_usdt, net_amount_usdt, address, network, status, created_at, updated_at`,
        [req.user.id, amount, WITHDRAWAL_FEE, netAmount, address, network]
      );

      if (!result.rows || result.rows.length === 0) {
        throw new Error('No rows returned from insert');
      }

      withdrawal = result.rows[0];
      console.log('[Withdrawal] Successfully created withdrawal record:', withdrawal.id);
    } catch (err: any) {
      console.error('[Withdrawal] Direct SQL insert failed:', err);
      return res.status(400).json({ error: `Failed to create withdrawal: ${err.message}` });
    }

    // Deduct full amount from user wallet immediately
    try {
      const updateResult = await pool.query(
        'UPDATE wallets SET usdt_balance = usdt_balance - $1 WHERE user_id = $2',
        [amount, req.user.id]
      );

      if (updateResult.rowCount === 0) {
        throw new Error('Wallet update failed - no rows affected');
      }

      console.log('[Withdrawal] Wallet updated - balance deducted');
    } catch (err: any) {
      console.error('[Withdrawal] Failed to update wallet:', err.message);
      // Delete withdrawal record if wallet update fails
      await pool.query('DELETE FROM withdrawals WHERE id = $1', [withdrawal.id]);
      return res.status(500).json({ error: 'Failed to process withdrawal' });
    }

    // Record platform fee (1 USDT)
    try {
      await pool.query(
        `INSERT INTO platform_earnings (source_type, source_id, amount, description)
         VALUES ($1, $2, $3, $4)`,
        ['withdrawal_fee', withdrawal.id, WITHDRAWAL_FEE, `Withdrawal fee from user ${req.user.id}`]
      );
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
