import { Router, Request, Response } from 'express';
import { getSupabaseQueryClient } from '../utils/supabase';
import { verifyIPNSignature, NOWPaymentsWebhookPayload, getMinimumUSDT } from '../utils/nowpayments';
import { sendDepositConfirmationEmail } from '../utils/email';

const router = Router();

// Parse JSON body for webhook
router.use((req: Request, res: Response, next: Function) => {
  let rawBody = '';
  req.setEncoding('utf8');

  req.on('data', (chunk: string) => {
    rawBody += chunk;
  });

  req.on('end', () => {
    (req as any).rawBody = rawBody;
    next();
  });
});

// NOWPayments IPN webhook
router.post('/nowpayments', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-nowpayments-sig'] as string;
    const rawBody = (req as any).rawBody;

    if (!signature || !rawBody) {
      return res.status(400).json({ error: 'Missing signature or body' });
    }

    // Parse payload first for signature verification
    const payload: NOWPaymentsWebhookPayload = JSON.parse(rawBody);
    
    // Verify signature
    if (!verifyIPNSignature(payload, signature)) {
      console.warn('[NOWPayments] Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Check for required fields
    if (!payload.payment_status || !payload.pay_address) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Only process confirmed payments
    if (payload.payment_status !== 'finished') {
      console.log(`Skipping payment ${payload.payment_id} with status ${payload.payment_status}`);
      return res.json({ success: true });
    }

    const db = getSupabaseQueryClient();

    // Find deposit address
    const addressResult = await db.exec(
      "SELECT id, user_id, network, provider, provider_wallet_id FROM deposit_addresses WHERE address = $1",
      [payload.pay_address]
    );

    if (!addressResult.rows || addressResult.rows.length === 0) {
      console.warn(`No user found for address ${payload.pay_address}`);
      return res.json({ success: true });
    }

    const addressRecord = addressResult.rows[0];

    // Get user email
    const userResult = await db.exec(
      "SELECT email FROM users WHERE id = $1",
      [addressRecord.user_id]
    );

    const user = userResult.rows?.[0];

    // Check for duplicate deposit (idempotency)
    const existingResult = await db.exec(
      "SELECT id FROM deposits WHERE provider_payment_id = $1",
      [payload.payment_id.toString()]
    );

    if (existingResult.rows && existingResult.rows.length > 0) {
      console.log(`Duplicate deposit event ${payload.payment_id}, ignoring`);
      return res.json({ success: true });
    }

    const amount = payload.actually_paid || payload.pay_amount;

    // Check minimum deposit - 10 USDT (enforced in backend, not NOWPayments)
    const MIN_DEPOSIT = getMinimumUSDT();
    if (amount < MIN_DEPOSIT) {
      console.log(`[NOWPayments] Deposit ${amount} below minimum ${MIN_DEPOSIT}, not crediting user`);
      
      // Persist sub-minimum deposit for audit trail
      await db.exec(
        `INSERT INTO deposits (user_id, address_id, network, amount, txid, provider, provider_payment_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'failed', CURRENT_TIMESTAMP)`,
        [addressRecord.user_id, addressRecord.id, addressRecord.network, amount, (payload as any).payin_hash || payload.payment_id.toString(), 'nowpayments', payload.payment_id.toString()]
      );
      
      return res.json({ success: true, message: `Deposit below minimum ${MIN_DEPOSIT} USDT` });
    }

    // Create deposit record
    let deposit: any;
    try {
      const depositResult = await db.exec(
        `INSERT INTO deposits (user_id, address_id, network, amount, txid, provider, provider_payment_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', CURRENT_TIMESTAMP)
         RETURNING *`,
        [addressRecord.user_id, addressRecord.id, addressRecord.network, amount, (payload as any).payin_hash || payload.payment_id.toString(), 'nowpayments', payload.payment_id.toString()]
      );

      if (!depositResult.rows || depositResult.rows.length === 0) {
        throw new Error('Failed to create deposit');
      }

      deposit = depositResult.rows[0];
    } catch (error: any) {
      // Handle unique constraint violation (duplicate payment ID)
      if (error.code === '23505') {
        console.log(`Duplicate deposit detected (unique constraint): ${payload.payment_id}`);
        return res.json({ success: true, message: 'Deposit already processed' });
      }
      console.error('Error creating deposit:', error);
      return res.status(500).json({ error: 'Failed to create deposit' });
    }

    // Credit wallet
    const walletResult = await db.exec(
      "SELECT usdt_balance FROM wallets WHERE user_id = $1",
      [addressRecord.user_id]
    );

    if (walletResult.rows && walletResult.rows.length > 0) {
      await db.exec(
        "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
        [amount, addressRecord.user_id]
      );
    } else {
      console.error(`Wallet not found for user ${addressRecord.user_id}`);
      return res.status(500).json({ error: 'Wallet not found' });
    }

    // Send confirmation email
    if (user?.email) {
      await sendDepositConfirmationEmail(user.email, amount, addressRecord.network);
    }

    // Log to audit
    try {
      await db.exec(
        `INSERT INTO audit_logs (action, resource_type, resource_id, details, created_at)
         VALUES ('deposit_confirmed', 'deposit', $1, $2, CURRENT_TIMESTAMP)`,
        [deposit.id, JSON.stringify({
          amount,
          network: addressRecord.network,
          provider_payment_id: payload.payment_id,
          user_id: addressRecord.user_id
        })]
      );
    } catch (auditError) {
      console.warn('[NOWPayments] Failed to log to audit:', auditError);
    }

    console.log(`[NOWPayments] Deposit confirmed: ${amount} USDT to user ${addressRecord.user_id}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[NOWPayments] Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
