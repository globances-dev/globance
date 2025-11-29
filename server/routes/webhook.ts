import { Router, Request, Response } from 'express';
import { supabase } from "../utils/supabase";
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

    // Find deposit address
    const { data: addressRecord, error: addressError } = await supabase
      .from('deposit_addresses')
      .select('id, user_id, network, provider, provider_wallet_id')
      .eq('address', payload.pay_address)
      .single();

    if (addressError) {
      if (addressError.code === 'PGRST116') {
        console.warn(`No user found for address ${payload.pay_address}`);
        return res.json({ success: true });
      }
      throw addressError;
    }

    // Get user email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', addressRecord.user_id)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      throw userError;
    }

    // Check for duplicate deposit (idempotency)
    const { data: existingDeposit, error: existingError } = await supabase
      .from('deposits')
      .select('id')
      .eq('provider_payment_id', payload.payment_id.toString())
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingDeposit) {
      console.log(`Duplicate deposit event ${payload.payment_id}, ignoring`);
      return res.json({ success: true });
    }

    const amount = payload.actually_paid || payload.pay_amount;

    // Check minimum deposit - 10 USDT (enforced in backend, not NOWPayments)
    const MIN_DEPOSIT = getMinimumUSDT();
    if (amount < MIN_DEPOSIT) {
      console.log(`[NOWPayments] Deposit ${amount} below minimum ${MIN_DEPOSIT}, not crediting user`);

      // Persist sub-minimum deposit for audit trail
      await supabase.from('deposits').insert({
        user_id: addressRecord.user_id,
        address_id: addressRecord.id,
        network: addressRecord.network,
        amount,
        txid: (payload as any).payin_hash || payload.payment_id.toString(),
        provider: 'nowpayments',
        provider_payment_id: payload.payment_id.toString(),
        status: 'failed',
        created_at: new Date().toISOString(),
      });

      return res.json({ success: true, message: `Deposit below minimum ${MIN_DEPOSIT} USDT` });
    }

    // Create deposit record
    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert({
        user_id: addressRecord.user_id,
        address_id: addressRecord.id,
        network: addressRecord.network,
        amount,
        txid: (payload as any).payin_hash || payload.payment_id.toString(),
        provider: 'nowpayments',
        provider_payment_id: payload.payment_id.toString(),
        status: 'completed',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (depositError || !deposit) {
      throw depositError || new Error('Failed to create deposit');
    }

    // Credit wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('usdt_balance')
      .eq('user_id', addressRecord.user_id)
      .maybeSingle();

    if (walletError) {
      throw walletError;
    }

    if (wallet) {
      const newBalance = (wallet.usdt_balance || 0) + amount;
      const { error: updateError } = await supabase
        .from('wallets')
        .update({
          usdt_balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', addressRecord.user_id);

      if (updateError) {
        throw updateError;
      }
    } else {
      console.error(`Wallet not found for user ${addressRecord.user_id}`);
      return res.status(500).json({ error: 'Wallet not found' });
    }

    // Send confirmation email
    if (user?.email) {
      await sendDepositConfirmationEmail(user.email, amount, addressRecord.network);
    }

    // Log to audit
    const { error: auditError } = await supabase.from('audit_logs').insert({
      action: 'deposit_confirmed',
      resource_type: 'deposit',
      resource_id: deposit.id,
      details: {
        amount,
        network: addressRecord.network,
        provider_payment_id: payload.payment_id,
        user_id: addressRecord.user_id,
      },
      created_at: new Date().toISOString(),
    });

    if (auditError) {
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
