# 🔗 NOWPayments Webhook Configuration Guide

**Platform:** Globance Cloud Mining  
**Integration:** NOWPayments IPN (Instant Payment Notification)  
**Purpose:** Automatic USDT deposit detection and balance crediting

---

## ✅ WEBHOOK STATUS

Your NOWPayments webhook is **fully implemented and ready** for configuration.

**Webhook Endpoint:** `https://globance.app/api/webhook/nowpayments`

**Implementation Features:**
- ✅ HMAC SHA-512 signature verification
- ✅ Idempotency (duplicate payment detection)
- ✅ Minimum deposit enforcement (10 USDT)
- ✅ Automatic balance crediting
- ✅ Email confirmation notifications
- ✅ Audit trail logging
- ✅ TRC20 & BEP20 support

---

## 📋 STEP-BY-STEP CONFIGURATION

### Step 1: Access NOWPayments Dashboard

1. Navigate to: **https://nowpayments.io**
2. Login with your NOWPayments account credentials
   - Email: (use value from `NOWPAYMENTS_EMAIL` secret)
   - Password: (use value from `NOWPAYMENTS_PASSWORD` secret)

### Step 2: Navigate to IPN Settings

1. Click on your **profile/account icon** (top right)
2. Select **"Settings"** from dropdown menu
3. Click on **"API"** or **"IPN Settings"** tab
4. Look for **"IPN (Instant Payment Notifications)"** section

### Step 3: Configure IPN Callback URL

**Set the IPN URL to:**
```
https://globance.app/api/webhook/nowpayments
```

**Important Notes:**
- ✅ Use HTTPS (not HTTP)
- ✅ Exact path: `/api/webhook/nowpayments`
- ✅ No trailing slash
- ❌ Do NOT use localhost or development URLs

### Step 4: Configure IPN Secret Key

**You have two options:**

#### Option A: Use Existing Secret (Recommended)
If you already have `NOWPAYMENTS_IPN_SECRET` configured in your Replit secrets:

1. In NOWPayments dashboard, locate **"IPN Secret Key"** field
2. **Copy the exact value** from your Replit secret `NOWPAYMENTS_IPN_SECRET`
3. **Paste it into NOWPayments IPN Secret field**
4. Save changes

#### Option B: Generate New Secret
If you need to create a new IPN secret:

1. In NOWPayments dashboard, click **"Generate Secret Key"**
2. **Copy the generated secret key**
3. **Save it to Replit secrets**:
   - Go to Replit Secrets panel
   - Update `NOWPAYMENTS_IPN_SECRET` with the new value
4. **Restart your server** for changes to take effect

⚠️ **CRITICAL:** The IPN secret in NOWPayments **MUST match** the `NOWPAYMENTS_IPN_SECRET` in your Replit environment!

### Step 5: Enable IPN Notifications

1. Find the **"Enable IPN"** toggle or checkbox
2. ✅ **Turn it ON** (enable)
3. Select notification types (if available):
   - ✅ Payment confirmed
   - ✅ Payment finished
   - ✅ Payment failed
4. Click **"Save"** or **"Update Settings"**

### Step 6: Verify Configuration

After saving, you should see:
- ✅ IPN URL: `https://globance.app/api/webhook/nowpayments`
- ✅ IPN Secret: `********` (masked for security)
- ✅ IPN Status: **Enabled** or **Active**

---

## 🧪 TESTING THE WEBHOOK

### Test 1: Make a Small Test Deposit

1. **Register a test account** on Globance:
   ```
   Navigate to: https://globance.app/register
   Email: test@yourdomain.com
   Password: TestPass123!
   Full Name: Test User
   ```

2. **Get your deposit address:**
   - Login to test account
   - Go to "My Wallet"
   - Click "Deposit USDT"
   - Copy your **TRC20** or **BEP20** address

3. **Send test deposit:**
   - Minimum: **10 USDT**
   - Network: TRC20 (Tron) or BEP20 (BSC)
   - From: Your personal wallet

4. **Wait for confirmation:**
   - TRC20: ~1-2 minutes
   - BEP20: ~1-3 minutes

5. **Verify balance updated:**
   - Refresh Globance wallet page
   - Balance should increase by deposit amount
   - Check email for confirmation

### Test 2: Check Server Logs

Monitor your Replit server logs for webhook activity:

```
Look for logs like:
[NOWPayments] Deposit confirmed: 10.00000000 USDT to user <user_id>
```

### Test 3: Verify Database Record

Check if deposit was recorded:

```sql
-- Connect to database
psql "$DATABASE_URL_PROD"

-- Check recent deposits
SELECT id, user_id, amount, network, status, created_at 
FROM deposits 
ORDER BY created_at DESC 
LIMIT 5;

-- Check wallet balance
SELECT user_id, usdt_balance 
FROM wallets 
WHERE user_id = '<test_user_id>';
```

---

## 🔍 WEBHOOK PAYLOAD EXAMPLE

When a deposit is confirmed, NOWPayments sends this payload:

```json
{
  "payment_id": 1234567890,
  "payment_status": "finished",
  "pay_address": "TAm9k5awnNuZiEcXkzvdiWK11qsLrYL2mz",
  "pay_amount": 10.5,
  "actually_paid": 10.5,
  "pay_currency": "usdttrc20",
  "order_id": null,
  "order_description": null,
  "payin_hash": "a1b2c3d4e5f6...",
  "outcome_amount": 10.5,
  "outcome_currency": "usdttrc20"
}
```

**Your webhook processes:**
1. ✅ Verifies HMAC signature
2. ✅ Checks payment_status = "finished"
3. ✅ Finds user by deposit address
4. ✅ Validates amount ≥ 10 USDT
5. ✅ Creates deposit record
6. ✅ Credits wallet balance
7. ✅ Sends email confirmation

---

## 🔐 SECURITY FEATURES

### Signature Verification
Every webhook request is verified using HMAC SHA-512:

```typescript
const signature = req.headers['x-nowpayments-sig'];
verifyIPNSignature(payload, signature);
```

**If signature fails:**
- ❌ Request rejected with 401 Unauthorized
- ⚠️ Warning logged: "Invalid webhook signature"
- 🚫 No balance changes occur

### Idempotency Protection
Duplicate payments are detected and rejected:

```typescript
// Check for duplicate deposit
SELECT id FROM deposits WHERE provider_payment_id = $1
```

**If duplicate detected:**
- ℹ️ Logged: "Duplicate deposit event, ignoring"
- ✅ Returns success (200) but no action taken
- 🔒 Prevents double-crediting

### Minimum Deposit Enforcement
Deposits below 10 USDT are rejected:

```typescript
if (amount < 10) {
  // Create failed deposit record for audit
  // Don't credit wallet
}
```

**If below minimum:**
- 📝 Deposit saved with status: `failed`
- 🚫 Balance NOT credited
- ℹ️ Logged: "Deposit below minimum"

---

## 🐛 TROUBLESHOOTING

### Issue 1: Webhook Not Receiving Requests

**Symptoms:**
- Deposits made but balance not updating
- No webhook logs in server

**Solutions:**
1. ✅ Verify IPN is **enabled** in NOWPayments dashboard
2. ✅ Check IPN URL is exactly: `https://globance.app/api/webhook/nowpayments`
3. ✅ Ensure server is deployed and running (not just development)
4. ✅ Test webhook endpoint manually:
   ```bash
   curl -X POST https://globance.app/api/webhook/nowpayments \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   
   # Should return 400 (missing signature) - means endpoint is accessible
   ```

### Issue 2: "Invalid signature" Error

**Symptoms:**
- Server logs: `[NOWPayments] Invalid webhook signature`
- Webhook returns 401 Unauthorized

**Solutions:**
1. ✅ **Verify secrets match:**
   - NOWPayments dashboard IPN secret
   - Replit secret `NOWPAYMENTS_IPN_SECRET`
   - **Must be identical**

2. ✅ **Regenerate secret:**
   - Generate new secret in NOWPayments
   - Update Replit secret
   - Restart server: `npm start`

3. ✅ **Check secret format:**
   - No extra spaces
   - No line breaks
   - Exact copy-paste

### Issue 3: Deposit Below Minimum

**Symptoms:**
- Deposit made but balance not credited
- Logs: "Deposit below minimum 10 USDT"

**Solutions:**
1. ✅ Ensure deposit amount ≥ 10 USDT
2. ✅ Account for network fees (send slightly more)
3. ✅ Check deposit record:
   ```sql
   SELECT * FROM deposits 
   WHERE status = 'failed' 
   ORDER BY created_at DESC;
   ```

### Issue 4: Duplicate Payment Detected

**Symptoms:**
- Logs: "Duplicate deposit event, ignoring"
- Balance credited once (correct behavior)

**Solutions:**
- ℹ️ This is **expected behavior** (idempotency protection)
- ✅ NOWPayments may send duplicate webhooks
- ✅ Your system correctly ignores duplicates
- ✅ User balance is safe (only credited once)

### Issue 5: Email Not Sent

**Symptoms:**
- Deposit successful but no email received

**Solutions:**
1. ✅ Verify SendGrid API key configured
2. ✅ Check email in spam/junk folder
3. ✅ Verify sender email verified in SendGrid
4. ✅ Check server logs for email errors

### Issue 6: Webhook Timing Out

**Symptoms:**
- NOWPayments retries webhook multiple times
- Slow response times

**Solutions:**
1. ✅ Database connection pool healthy
2. ✅ Server has sufficient resources
3. ✅ Check for slow queries
4. ✅ Enable database query logging

---

## 📊 MONITORING

### Recommended Monitoring

**Database Queries:**
```sql
-- Recent deposits (last 24 hours)
SELECT 
  d.id,
  u.email,
  d.amount,
  d.network,
  d.status,
  d.created_at
FROM deposits d
JOIN users u ON d.user_id = u.id
WHERE d.created_at > NOW() - INTERVAL '24 hours'
ORDER BY d.created_at DESC;

-- Failed deposits
SELECT * FROM deposits 
WHERE status = 'failed'
ORDER BY created_at DESC;

-- Total deposits by network
SELECT 
  network,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM deposits
WHERE status = 'completed'
GROUP BY network;
```

**Server Logs to Monitor:**
- `[NOWPayments] Deposit confirmed`
- `[NOWPayments] Invalid webhook signature`
- `Duplicate deposit event`
- `Deposit below minimum`

**Metrics to Track:**
- Total deposits (count)
- Total deposit volume (USDT)
- Average deposit amount
- Failed deposit rate
- Webhook response time

---

## ✅ CONFIGURATION CHECKLIST

Before going live, verify:

- [ ] NOWPayments IPN URL configured: `https://globance.app/api/webhook/nowpayments`
- [ ] IPN Secret matches between NOWPayments and Replit
- [ ] IPN notifications enabled in NOWPayments dashboard
- [ ] Server deployed and running (not development mode)
- [ ] Test deposit completed successfully (10+ USDT)
- [ ] Balance credited correctly
- [ ] Email confirmation received
- [ ] Database deposit record created
- [ ] Server logs show webhook processing
- [ ] No signature verification errors

---

## 🎯 QUICK REFERENCE

**Webhook URL:**
```
https://globance.app/api/webhook/nowpayments
```

**Supported Networks:**
- TRC20 (Tron) - Recommended (lower fees)
- BEP20 (Binance Smart Chain)

**Minimum Deposit:**
- 10 USDT (enforced in backend)

**Confirmation Times:**
- TRC20: ~1-2 minutes
- BEP20: ~1-3 minutes

**Webhook Headers:**
```
Content-Type: application/json
x-nowpayments-sig: <HMAC_SHA512_signature>
```

**Payment Status Flow:**
```
waiting → confirming → confirmed → sending → finished ✅
                                            ↓
                         (Your webhook processes here)
```

---

## 📞 SUPPORT

**NOWPayments Support:**
- Website: https://nowpayments.io/help
- Email: support@nowpayments.io
- Telegram: @NOWPayments_bot
- Documentation: https://documenter.getpostman.com/view/7907941/

**Webhook Issues:**
- Check server logs first
- Verify IPN secret matches
- Test with small amount (10-20 USDT)
- Contact NOWPayments if webhook not triggered

---

## 🎉 COMPLETION

Once configured, your users can:
1. ✅ Register on Globance
2. ✅ Get permanent TRC20/BEP20 addresses
3. ✅ Deposit USDT (min 10 USDT)
4. ✅ Balance auto-credited within minutes
5. ✅ Receive email confirmation
6. ✅ Buy mining packages immediately

**Your webhook is production-ready!** 🚀

---

**Last Updated:** November 24, 2025  
**Status:** Ready for Configuration
