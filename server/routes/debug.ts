import { Router, Request, Response } from 'express';
import { getSupabaseQueryClient } from '../utils/supabase';
import crypto from 'crypto';
import { hashPassword, generateReferralCode } from '../utils/crypto';

const router = Router();

// In-memory debug logs (for session)
let debugLogs: Array<{ timestamp: string; level: string; message: string; data?: any }> = [];

function logDebug(level: string, message: string, data?: any) {
  const log = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
  };
  debugLogs.push(log);
  console.log(`[${level}] ${message}`, data || '');
}

// ============================================================
// 1. MOCK DEPOSIT ENDPOINT
// ============================================================
router.post('/mock-deposit', async (req: Request, res: Response) => {
  try {
    const { user_id, amount, currency, network, tx_id } = req.body;

    if (!user_id || !amount || !network) {
      return res.status(400).json({ error: 'Missing required fields: user_id, amount, network' });
    }

    logDebug('INFO', `Mock deposit initiated: ${amount} ${currency} on ${network}`, { user_id, amount, network, tx_id });

    const db = getSupabaseQueryClient();

    // Get user
    const userResult = await db.exec(
      'SELECT id, email FROM users WHERE id = $1',
      [user_id]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Create deposit record
    const depositResult = await db.exec(
      `INSERT INTO deposits (user_id, network, amount, txid, provider, provider_event_id, status, confirmed_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', CURRENT_TIMESTAMP)
       RETURNING *`,
      [user_id, network, amount, tx_id || `mock_${Date.now()}`, 'mock_test', `mock_${crypto.randomBytes(8).toString('hex')}`]
    );

    if (!depositResult.rows || depositResult.rows.length === 0) {
      logDebug('ERROR', 'Failed to create deposit');
      return res.status(400).json({ error: 'Failed to create deposit' });
    }

    const deposit = depositResult.rows[0];

    // Update wallet
    const walletResult = await db.exec(
      'SELECT usdt_balance FROM wallets WHERE user_id = $1',
      [user_id]
    );

    if (walletResult.rows && walletResult.rows.length > 0) {
      const wallet = walletResult.rows[0];
      await db.exec(
        'UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2',
        [amount, user_id]
      );

      logDebug('SUCCESS', `Wallet updated: +${amount} USDT`, { balance: (wallet.usdt_balance || 0) + amount });
    }

    // Log to audit
    await db.exec(
      `INSERT INTO audit_logs (admin_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [user_id, 'mock_deposit_created', 'deposit', deposit.id, JSON.stringify({ amount, network, tx_id })]
    );

    // Simulate email
    console.log(`\n📧 [MOCK EMAIL] Deposit Confirmation\nTo: ${user.email}\nSubject: Deposit Confirmed - ${amount} USDT (${network})\n✅ Your deposit of ${amount} USDT on ${network} has been confirmed!\n`);

    res.json({
      success: true,
      deposit: {
        id: deposit.id,
        amount,
        network,
        status: 'confirmed',
        tx_id,
      },
    });
  } catch (error: any) {
    logDebug('ERROR', `Mock deposit error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 2. MOCK WITHDRAWAL ENDPOINT
// ============================================================
router.post('/mock-withdrawal', async (req: Request, res: Response) => {
  try {
    const { user_id, amount, network, address } = req.body;

    if (!user_id || !amount || !network || !address) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    logDebug('INFO', `Mock withdrawal initiated: ${amount} ${network}`, { user_id, address });

    const db = getSupabaseQueryClient();

    // Get user
    const userResult = await db.exec(
      'SELECT id, email FROM users WHERE id = $1',
      [user_id]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check balance
    const walletResult = await db.exec(
      'SELECT usdt_balance FROM wallets WHERE user_id = $1',
      [user_id]
    );

    if (!walletResult.rows || walletResult.rows.length === 0 || walletResult.rows[0].usdt_balance < amount) {
      logDebug('ERROR', 'Insufficient balance for withdrawal');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const wallet = walletResult.rows[0];

    // Create withdrawal request
    const withdrawalResult = await db.exec(
      `INSERT INTO withdrawals (user_id, amount_usdt, fee_usdt, net_amount_usdt, address, network, status)
       VALUES ($1, $2, 1, $3, $4, $5, 'pending')
       RETURNING *`,
      [user_id, amount, amount - 1, address, network]
    );

    if (!withdrawalResult.rows || withdrawalResult.rows.length === 0) {
      return res.status(400).json({ error: 'Failed to create withdrawal' });
    }

    const withdrawal = withdrawalResult.rows[0];

    // Deduct from wallet
    await db.exec(
      'UPDATE wallets SET usdt_balance = usdt_balance - $1 WHERE user_id = $2',
      [amount, user_id]
    );

    logDebug('SUCCESS', 'Withdrawal request created', { withdrawal_id: withdrawal.id, status: 'pending' });

    console.log(`\n📧 [MOCK EMAIL] Withdrawal Request\nTo: ${user.email}\nSubject: Withdrawal Request - ${amount} USDT\n⏳ Your withdrawal request for ${amount} USDT is pending admin approval.\n`);

    res.json({
      success: true,
      withdrawal: {
        id: withdrawal.id,
        amount,
        network,
        address,
        status: 'pending',
      },
    });
  } catch (error: any) {
    logDebug('ERROR', `Mock withdrawal error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 3. MOCK WEBHOOK ENDPOINT
// ============================================================
router.post('/mock-webhook', async (req: Request, res: Response) => {
  try {
    const { payment_id, payment_status, pay_amount, pay_currency, network, address } = req.body;

    logDebug('INFO', 'Mock webhook received', { payment_id, payment_status, pay_amount, network });

    if (payment_status !== 'finished') {
      logDebug('INFO', `Skipping webhook for status: ${payment_status}`);
      return res.json({ success: true });
    }

    const db = getSupabaseQueryClient();

    // Find deposit address
    const addressResult = await db.exec(
      'SELECT user_id FROM deposit_addresses WHERE address = $1',
      [address]
    );

    if (!addressResult.rows || addressResult.rows.length === 0) {
      // Check if this is a mock test address
      const userResult = await db.exec(
        'SELECT id, email FROM users LIMIT 1'
      );

      if (!userResult.rows || userResult.rows.length === 0) {
        return res.json({ success: true });
      }

      const user = userResult.rows[0];

      // For testing, credit to first user
      await db.exec(
        `INSERT INTO deposits (user_id, amount, txid, network, provider, provider_event_id, status, confirmed_at)
         VALUES ($1, $2, $3, $4, 'mock_test', $5, 'confirmed', CURRENT_TIMESTAMP)`,
        [user.id, pay_amount, `mock_${payment_id}`, network, `mock_${payment_id}`]
      );

      // Update wallet
      await db.exec(
        'UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2',
        [pay_amount, user.id]
      );

      logDebug('SUCCESS', 'Webhook processed - funds credited', { amount: pay_amount, user: user.id });
      return res.json({ success: true });
    }

    const addressRecord = addressResult.rows[0];

    // Check for duplicate
    const dupResult = await db.exec(
      'SELECT id FROM deposits WHERE provider_event_id = $1',
      [`mock_${payment_id}`]
    );

    if (dupResult.rows && dupResult.rows.length > 0) {
      logDebug('INFO', 'Duplicate webhook detected');
      return res.json({ success: true });
    }

    // Create deposit
    await db.exec(
      `INSERT INTO deposits (user_id, amount, txid, network, provider, provider_event_id, status, confirmed_at)
       VALUES ($1, $2, $3, $4, 'mock_test', $5, 'confirmed', CURRENT_TIMESTAMP)`,
      [addressRecord.user_id, pay_amount, `mock_${payment_id}`, network, `mock_${payment_id}`]
    );

    // Update wallet
    await db.exec(
      'UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2',
      [pay_amount, addressRecord.user_id]
    );

    logDebug('SUCCESS', 'Webhook processed and credited', { amount: pay_amount });
    res.json({ success: true });
  } catch (error: any) {
    logDebug('ERROR', `Mock webhook error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 4. DEBUG LOGS ENDPOINT
// ============================================================
router.get('/logs', (req: Request, res: Response) => {
  res.json({
    logs: debugLogs.slice(-100),
    total: debugLogs.length,
  });
});

// ============================================================
// 5. TEST REGISTRATION ENDPOINT
// ============================================================
router.post('/test-registration', async (req: Request, res: Response) => {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    logDebug('INFO', 'Test registration started', { email, full_name });

    const db = getSupabaseQueryClient();

    // Step 1: Check if email exists
    logDebug('INFO', 'Step 1: Checking if email exists');
    const existingResult = await db.exec(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingResult.rows && existingResult.rows.length > 0) {
      logDebug('ERROR', 'Email already exists');
      return res.status(400).json({ error: 'Email already registered' });
    }
    logDebug('SUCCESS', 'Step 1 complete: Email is available');

    // Step 2: Hash password
    logDebug('INFO', 'Step 2: Hashing password');
    const passwordHash = await hashPassword(password);
    logDebug('SUCCESS', 'Step 2 complete: Password hashed');

    // Step 3: Generate referral code
    logDebug('INFO', 'Step 3: Generating referral code');
    const refCode = generateReferralCode();
    logDebug('SUCCESS', `Step 3 complete: Referral code generated: ${refCode}`);

    // Step 4: Create user
    logDebug('INFO', 'Step 4: Creating user in database');
    const userResult = await db.exec(
      `INSERT INTO users (email, password_hash, username, verified)
       VALUES ($1, $2, $3, false)
       RETURNING id, email, username`,
      [email, passwordHash, full_name]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      logDebug('ERROR', 'User creation failed');
      return res.status(400).json({ error: 'User creation failed' });
    }

    const newUser = userResult.rows[0];
    logDebug('SUCCESS', 'Step 4 complete: User created', { user_id: newUser.id });

    // Step 5: Create wallet
    logDebug('INFO', 'Step 5: Creating wallet');
    await db.exec(
      `INSERT INTO wallets (user_id, usdt_balance)
       VALUES ($1, 0)`,
      [newUser.id]
    );

    logDebug('SUCCESS', 'Step 5 complete: Wallet created');
    logDebug('SUCCESS', 'Test registration completed successfully');

    res.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        full_name: newUser.username,
      },
      message: 'User created successfully',
    });
  } catch (error: any) {
    logDebug('ERROR', `Test registration error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 6. HEALTH ENDPOINT
// ============================================================
router.get('/health', async (req: Request, res: Response) => {
  try {
    const db = getSupabaseQueryClient();

    const userResult = await db.exec('SELECT COUNT(*) as count FROM users');
    const depositResult = await db.exec('SELECT COUNT(*) as count FROM deposits');
    const purchaseResult = await db.exec('SELECT COUNT(*) as count FROM purchases');

    res.json({
      status: 'healthy',
      environment: process.env.ENVIRONMENT || 'unknown',
      database: 'connected',
      stats: {
        users: parseInt(userResult.rows[0].count) || 0,
        deposits: parseInt(depositResult.rows[0].count) || 0,
        purchases: parseInt(purchaseResult.rows[0].count) || 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

// ============================================================
// 7. CLEAR DEBUG LOGS
// ============================================================
router.post('/clear-logs', (req: Request, res: Response) => {
  debugLogs = [];
  res.json({ success: true, message: 'Debug logs cleared' });
});

export default router;
