# Globance Backend Setup & API Documentation

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- pnpm package manager
- Supabase project
- NOWPayments production account
- SendGrid account (optional for development)

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Configure your .env.local with credentials:
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NOWPAYMENTS_API_KEY=your_nowpayments_key
NOWPAYMENTS_IPN_SECRET=your_ipn_secret
SENDGRID_API_KEY=your_sendgrid_key
JWT_SECRET=your_jwt_secret

# Start development server
pnpm dev
```

The backend runs on the same dev server as the frontend at port 8080.

---

## 📊 Database Schema

### Core Tables

#### `users`
- `id` (UUID, PK)
- `email` (VARCHAR, unique)
- `password_hash` (VARCHAR)
- `full_name` (VARCHAR)
- `role` (user|admin)
- `ref_code` (VARCHAR, unique) - Referral code
- `ref_by` (UUID) - Referred by user ID
- `is_frozen` (BOOLEAN)
- `created_at`, `updated_at`

#### `wallets`
- `id` (UUID, PK)
- `user_id` (UUID, FK, unique)
- `usdt_balance` (DECIMAL)
- `escrow_balance` (DECIMAL) - Locked in P2P trades

#### `deposit_addresses`
- `id` (UUID, PK)
- `user_id` (UUID, FK)
- `network` (TRC20|BEP20)
- `address` (VARCHAR, unique per user/network)
- `provider_wallet_id` (VARCHAR)

#### `deposits`
- `id` (UUID, PK)
- `user_id` (UUID, FK)
- `amount` (DECIMAL)
- `status` (pending|confirmed|failed)
- `provider_event_id` (VARCHAR, unique) - For idempotency
- `txid` (VARCHAR)

#### `packages`
- `id` (UUID, PK)
- `name` (Bronze|Silver|Gold|Platinum|Diamond|Legendary)
- `min_amount` (DECIMAL)
- `daily_percent` (DECIMAL)
- `duration_days` (INTEGER, default 270)
- `referral_required` (INTEGER)

#### `purchases`
- `id` (UUID, PK)
- `user_id` (UUID, FK)
- `package_id` (UUID, FK)
- `amount` (DECIMAL)
- `start_time`, `end_time`, `last_reward_time` (TIMESTAMP)
- `status` (active|completed|cancelled)
- `total_earned` (DECIMAL)

#### `offers` (P2P Ads)
- `id` (UUID, PK)
- `user_id` (UUID, FK)
- `type` (buy|sell)
- `amount`, `price` (DECIMAL)
- `network` (TRC20|BEP20)
- `fiat_currency` (ETB|USD|EUR|etc)
- `country`, `payment_method`
- `status` (active|inactive|completed)

#### `trades`
- `id` (UUID, PK)
- `offer_id` (UUID, FK)
- `buyer_id`, `seller_id` (UUID, FK)
- `amount`, `escrow` (DECIMAL)
- `status` (pending|paid|confirmed|completed|disputed|cancelled)

#### `disputes`
- `id` (UUID, PK)
- `trade_id` (UUID, FK)
- `reason`, `evidence` (VARCHAR)
- `status` (open|resolved|closed)
- `resolution` (VARCHAR)

#### `referrals`
- `referrer_id`, `referred_id` (UUID, FK)
- `commission_level` (1|2|3)
- `commission_amount` (DECIMAL)
- `commission_type` (purchase|daily_earning)

#### `audit_logs`
- `id` (UUID, PK)
- `admin_id` (UUID, FK)
- `action` (VARCHAR)
- `resource_type`, `resource_id` (VARCHAR, UUID)
- `details` (JSONB)

---

## 🔐 API Endpoints

### Authentication

#### Register
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "full_name": "John Doe",
  "ref_by": "REFERRAL_CODE" (optional)
}

Response: { token, user }
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response: { token, user }
```

#### Get Current User
```
GET /api/auth/me
Authorization: Bearer {token}

Response: { user }
```

#### Password Reset Request
```
POST /api/auth/password-reset-request
Content-Type: application/json

{
  "email": "user@example.com"
}

Response: { success }
```

---

### Wallet & Deposits

#### Get Balance
```
GET /api/wallet/balance
Authorization: Bearer {token}

Response: { usdt_balance, escrow_balance }
```

#### Get Deposit Addresses
```
GET /api/wallet/deposit-addresses
Authorization: Bearer {token}

Response: { addresses: [{ network, address, ... }] }
```

Auto-generates TRC20 and BEP20 addresses via NOWPayments API if missing.

#### Get Deposit History
```
GET /api/wallet/deposit-history
Authorization: Bearer {token}

Response: { deposits: [...] }
```

#### Request Withdrawal
```
POST /api/wallet/withdrawal-request
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount": 100.00,
  "address": "TQX...",
  "network": "TRC20"
}

Response: { withdrawal: { id, amount, status } }
```

#### Get Withdrawal History
```
GET /api/wallet/withdrawal-history
Authorization: Bearer {token}

Response: { withdrawals: [...] }
```

---

### Webhook (NOWPayments)

#### IPN Webhook (Deposits)
```
POST /api/webhook/nowpayments
x-nowpayments-sig: {signature}

Verifies webhook signature, creates deposit record, auto-credits wallet.
Minimum deposit: 5 USDT (below that = pending status).
```

**Setup in NOWPayments dashboard:**
- URL: `https://globance.org/api/webhook/nowpayments`
- Verify signature using `NOWPAYMENTS_IPN_SECRET`

---

### Cloud Mining Packages

#### Get All Packages
```
GET /api/packages

Response: { packages: [...] }
```

#### Buy Package
```
POST /api/packages/buy
Authorization: Bearer {token}
Content-Type: application/json

{
  "package_id": "uuid"
}

- Checks balance >= min_amount
- Checks referrals >= required (if Silver+)
- Creates purchase record
- Processes multi-level referral commissions (10%, 3%, 2%)
- Deducts from wallet

Response: { purchase: { id, amount, daily_percent, duration_days } }
```

#### Get User's Active Purchases
```
GET /api/packages/user/purchases
Authorization: Bearer {token}

Response: { purchases: [{ ..., accrued_earnings, daily_earning }] }
```

Calculates accrued earnings since last reward.

---

### Mining (Daily Earnings)

#### Process Daily Earnings (Cron Job)
```
POST /api/mining/process-daily-earnings
x-cron-secret: {CRON_SECRET}

Runs every day at 9:00 PM UTC.
- Updates last_reward_time (24h window)
- Credits daily earnings to user wallet
- Distributes referral earnings (10%, 3%, 2% per level)
- Logs all transactions

Call this endpoint with a cron service (GitHub Actions, EasyCron, etc.)
```

---

### P2P Marketplace

#### Get All Active Offers
```
GET /api/p2p/offers?type=buy&currency=ETB&network=TRC20

Response: { offers: [...] }
```

#### Create Buy/Sell Offer
```
POST /api/p2p/offers
Authorization: Bearer {token}
Content-Type: application/json

{
  "type": "sell",
  "amount": 100.00,
  "price": 175.50,
  "network": "TRC20",
  "fiat_currency": "ETB",
  "country": "Ethiopia",
  "payment_method": "Bank Transfer",
  "min_limit": 50.00,
  "max_limit": 500.00,
  "margin": 2.5,
  "kyc_required": false
}

- Validates price within admin-set range
- Creates offer record

Response: { offer: {...} }
```

#### Get My Offers
```
GET /api/p2p/my-offers
Authorization: Bearer {token}

Response: { offers: [...] }
```

#### Accept Offer (Create Trade)
```
POST /api/p2p/accept-offer
Authorization: Bearer {token}
Content-Type: application/json

{
  "offer_id": "uuid",
  "amount": 50.00
}

For SELL offers:
- Locks seller's USDT in escrow
- Creates trade record
- Trade status: "pending"

Response: { trade: {...} }
```

#### Get My Trades
```
GET /api/p2p/my-trades
Authorization: Bearer {token}

Response: { trades: [...] }
```

#### Mark Payment Received (Buyer)
```
POST /api/p2p/trades/{trade_id}/mark-paid
Authorization: Bearer {token}

- Updates trade status: "paid"
- Notifies seller via email

Response: { trade: {...} }
```

#### Confirm & Release Escrow (Seller)
```
POST /api/p2p/trades/{trade_id}/confirm-received
Authorization: Bearer {token}

- Releases escrow to buyer's wallet
- Updates trade status: "completed"
- Notifies buyer via email

Response: { trade: {...} }
```

---

### Admin Panel

**All admin endpoints require:**
```
Authorization: Bearer {token}
User role must be "admin"
```

#### Get All Users
```
GET /api/admin/users?search=john&role=user

Response: { users: [...] }
```

#### Freeze/Unfreeze Account
```
POST /api/admin/users/{user_id}/freeze
Content-Type: application/json

{ "is_frozen": true }

Response: { user: {...} }
```

#### Change User Role
```
POST /api/admin/users/{user_id}/role
Content-Type: application/json

{ "role": "admin" }

Response: { user: {...} }
```

#### Get Pending Withdrawals
```
GET /api/admin/withdrawals/pending

Response: { withdrawals: [...] }
```

#### Execute Withdrawal
```
POST /api/admin/withdrawals/{withdrawal_id}/execute
Content-Type: application/json

{
  "provider_txid": "0x123..." (optional)
}

If no txid provided:
- Calls NOWPayments payout API
- Executes actual payout
- Records txid

Response: { withdrawal: {...} }
```

#### Create/Update Package
```
POST /api/admin/packages
Content-Type: application/json

{
  "name": "Ruby",
  "min_amount": 1500.00,
  "daily_percent": 3.1,
  "referral_required": 30
}

Response: { package: {...} }
```

#### Set P2P Price Range
```
POST /api/admin/p2p-price-ranges
Content-Type: application/json

{
  "fiat_currency": "ETB",
  "min_price": 165.00,
  "max_price": 185.00
}

Response: { priceRange: {...} }
```

#### Get Disputes
```
GET /api/admin/disputes?status=open

Response: { disputes: [...] }
```

#### Resolve Dispute
```
POST /api/admin/disputes/{dispute_id}/resolve
Content-Type: application/json

{
  "resolution": "Refund seller, trade cancelled",
  "refund_to": "seller"
}

Response: { dispute: {...} }
```

#### Get Audit Logs
```
GET /api/admin/audit-logs

Response: { logs: [...] }
```

---

## 🔄 Cron Job Setup

The daily earnings need to run every day at 9:00 PM UTC.

### Option 1: GitHub Actions (Free)
```yaml
name: Daily Mining Earnings

on:
  schedule:
    - cron: '0 21 * * *'  # 9 PM UTC

jobs:
  process-earnings:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Process Daily Earnings
        run: |
          curl -X POST https://globance.org/api/mining/process-daily-earnings \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
```

### Option 2: EasyCron (https://www.easycron.com/)
- URL: `https://globance.org/api/mining/process-daily-earnings`
- Headers: `x-cron-secret: your_cron_secret`
- Schedule: `0 21 * * *` (9 PM UTC)

### Option 3: Self-Hosted (Node.js)
```javascript
const cron = require('node-cron');
const fetch = require('node-fetch');

// Run daily at 9 PM UTC
cron.schedule('0 21 * * *', async () => {
  await fetch('https://globance.org/api/mining/process-daily-earnings', {
    method: 'POST',
    headers: {
      'x-cron-secret': process.env.CRON_SECRET,
    },
  });
});
```

---

## 🔐 Webhook Signature Verification

NOWPayments signs webhooks with HMAC-SHA512:

```javascript
const crypto = require('crypto');

const signature = req.headers['x-nowpayments-sig'];
const hmac = crypto.createHmac('sha512', IPN_SECRET);
hmac.update(rawBody);
const calculatedSig = hmac.digest('hex');

const isValid = calculatedSig === signature;
```

**Important:** Must verify signature before processing deposits.

---

## 📧 Email Notifications

Sent via SendGrid for:
- ✅ Registration confirmation
- ✅ Deposit confirmation
- ✅ Withdrawal status updates
- ✅ P2P trade updates
- ✅ Password reset

In development (no SENDGRID_API_KEY), emails are logged to console.

---

## 🚀 Production Deployment

### Netlify Functions (Recommended)
```bash
# Build
pnpm build

# Deploy
netlify deploy --prod
```

The server runs as a Node.js function at `/.netlify/functions/api`.

### Vercel
```bash
# vercel.json already configured
vercel deploy --prod
```

### Self-Hosted (Linux/Docker)
```bash
# Build
pnpm build

# Start
pnpm start
```

Server runs on port 3000 (configurable via PORT env var).

---

## 🔑 Environment Variables Checklist

- [ ] `VITE_SUPABASE_URL` - Supabase project URL
- [ ] `VITE_SUPABASE_ANON_KEY` - Supabase anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- [ ] `NOWPAYMENTS_API_KEY` - NOWPayments API key
- [ ] `NOWPAYMENTS_IPN_SECRET` - NOWPayments webhook secret
- [ ] `SENDGRID_API_KEY` - SendGrid API key (optional)
- [ ] `JWT_SECRET` - Strong random string for JWT signing
- [ ] `CRON_SECRET` - Secret for cron job authentication
- [ ] `APP_URL` - Base URL for email links (e.g., https://globance.org)
- [ ] `ADMIN_EMAIL` - Admin email for notifications

---

## 🧪 Testing Checklist

### Authentication Flow
- [ ] Register new user
- [ ] Verify referral code generated
- [ ] Login with credentials
- [ ] JWT token expires after 7 days
- [ ] Password reset email sends correctly

### Deposit Flow
- [ ] User receives unique TRC20 address
- [ ] User receives unique BEP20 address
- [ ] NOWPayments webhook confirmed >= 5 USDT
- [ ] Wallet balance updated automatically
- [ ] Deposit confirmation email sent
- [ ] Duplicate webhooks (idempotency) handled

### Mining Flow
- [ ] User can purchase Bronze (no referral required)
- [ ] User cannot purchase Silver without 5 referrals
- [ ] Daily earnings calculated correctly (24h window)
- [ ] Referral commissions credited (10%, 3%, 2%)
- [ ] Last reward time updated

### P2P Flow
- [ ] User creates buy/sell offer
- [ ] Price validated against admin range
- [ ] Buyer accepts offer
- [ ] Seller's USDT locked in escrow
- [ ] Buyer marks as paid
- [ ] Seller confirms
- [ ] Escrow released to buyer

### Admin Flow
- [ ] Admin can view all users
- [ ] Admin can freeze accounts
- [ ] Admin can approve withdrawals
- [ ] Admin can execute payout
- [ ] Admin can set price ranges
- [ ] Admin can resolve disputes
- [ ] Audit logs recorded

---

## 🐛 Troubleshooting

### Deposits Not Crediting
1. Check NOWPayments webhook is registered
2. Verify IPN secret matches
3. Check Supabase deposit_addresses table for address
4. Verify webhook signature verification passing
5. Check minimum deposit is >= 5 USDT

### Mining Not Running
1. Verify cron job is actually calling endpoint
2. Check `x-cron-secret` header matches env variable
3. Verify Supabase connection
4. Check last_reward_time is being updated

### Withdrawals Failing
1. Verify user has sufficient balance
2. Check NOWPayments API key is correct
3. Verify address format (TRC20/BEP20)
4. Check network selection (TRC20 vs BEP20)

### P2P Issues
1. Verify price within admin range
2. Check seller has sufficient balance for escrow
3. Verify trade status transitions
4. Check email notifications sending

---

## 📞 Support

For issues, check:
1. Supabase dashboard - verify data in tables
2. NOWPayments account - verify webhook logs
3. SendGrid dashboard - verify email delivery
4. Application logs - check error messages
5. GitHub issues or documentation

---

## License

© 2024 Globance. All rights reserved.
