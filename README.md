# Globance - Cloud Mining & P2P Marketplace Platform

A production-ready cloud mining and peer-to-peer marketplace platform built with Node.js, Express, React, and Supabase.

## 🎯 Features

- **Cloud Mining Packages**: 6 tiered investment packages (Bronze → Legendary) with daily earnings
- **3-Level Referral System**: Earn 10%, 3%, 2% on referral bonuses and daily income
- **P2P Marketplace**: Buy/sell USDT with escrow protection
- **Auto-Rank Upgrades**: Automatically advance ranks based on investments and referrals
- **Daily Mining Earnings**: Automated 21:00 UTC cron job distributes earnings
- **Deposits via NOWPayments**: Production-ready payment gateway integration
- **Real-time Wallet Balances**: Live balance tracking and transaction history
- **Admin Dashboard**: Complete visibility into users, transactions, and system health

## 📋 Tech Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT
- **Styling**: Tailwind CSS + Radix UI

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm (or npm)
- Supabase account (free tier works)
- NOWPayments account (for production deposits)
- Cron service account (cron-job.org or similar)

### Installation

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd globance

# 2. Install dependencies
pnpm install

# 3. Create .env file (see Environment Variables section below)
cp .env.example .env

# 4. Configure your environment variables
# Edit .env with your Supabase and API keys

# 5. Run database migration
# See "Database Setup" section below

# 6. Start development server
pnpm dev
```

### Running in Production

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## 🗄️ Database Setup (CRITICAL - Run Only Once)

### Step 1: Get Your Production Supabase Project

1. Go to https://supabase.com
2. Create a new project named **"globance"** (or use existing)
3. Note your project URL and service role key

### Step 2: Run the Production Migration

1. Open Supabase Dashboard → SQL Editor
2. Create a new query
3. Copy the entire contents from `server/migrations/001_production_schema.sql`
4. Paste into the SQL Editor
5. Click "Run"
6. ✅ Confirm all tables are created (you should see 14 tables created)

### Verification

Run this query in Supabase SQL Editor to confirm:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables:

- audit_logs
- cron_logs
- deposit_addresses
- deposits
- earnings_transactions
- offers
- packages
- purchases
- referral_bonus_transactions
- trades
- users
- wallets

## 🔐 Environment Variables

Create a `.env` file in the project root:

```bash
# Supabase (Production Only)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# JWT & Security
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
CRON_SECRET=your-cron-secret-min-32-chars

# Payment Gateway (NOWPayments - Production)
NOWPAYMENTS_API_KEY=your-nowpayments-api-key
NOWPAYMENTS_IPN_SECRET=your-nowpayments-ipn-secret

# Email Service (SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key

# Application
NODE_ENV=production
APP_URL=https://your-domain.com
ADMIN_EMAIL=support@your-domain.com
```

### Where to Find Keys

**Supabase**:

1. Dashboard → Settings → API
2. Copy `anon` key and `service_role` key

**JWT_SECRET & CRON_SECRET**:

- Generate random 32+ character strings
- Use: `openssl rand -base64 32`

**NOWPayments**:

1. Dashboard → API Settings
2. Get API Key and IPN Secret

## 📡 API Endpoints

### Authentication

```
POST   /api/auth/register        - Register new user
POST   /api/auth/login           - Login user
GET    /api/auth/me              - Get current user
```

### Wallet

```
GET    /api/wallet               - Get wallet balance
GET    /api/wallet/deposit-addresses - Get deposit addresses
GET    /api/wallet/transactions  - Get wallet transaction history
```

### Packages (Cloud Mining)

```
GET    /api/packages             - List all packages
POST   /api/packages/buy         - Buy a package
```

### Mining Earnings (Cron Job)

```
POST   /api/mining/process-daily-earnings    - Daily cron (21:00 UTC)
POST   /api/mining/run-daily-earnings-test  - Manual test run
```

### P2P Marketplace

```
GET    /api/p2p/offers           - List active offers
POST   /api/p2p/offers           - Create new offer
POST   /api/p2p/trades           - Create trade
POST   /api/p2p/trades/release-escrow - Release escrowed funds
```

### Admin (Protected)

```
GET    /api/admin/users          - List all users
GET    /api/admin/cron-logs      - View cron execution logs
GET    /api/admin/referral-transactions - View referral bonuses
GET    /api/admin/earnings-transactions - View earnings log
GET    /api/admin/referral-tree/:userId - View referral tree (3 levels)
GET    /api/admin/referral-stats/:userId - Get user stats
```

### Webhooks

```
POST   /api/nowpayments/webhook  - NOWPayments IPN webhook
```

## 💰 Cloud Mining Packages

| Package   | Min Invest | Daily % | Referrals Needed |
| --------- | ---------- | ------- | ---------------- |
| Bronze    | 10 USDT    | 2.5%    | 0                |
| Silver    | 100 USDT   | 2.6%    | 5                |
| Gold      | 300 USDT   | 2.7%    | 10               |
| Platinum  | 500 USDT   | 2.8%    | 15               |
| Diamond   | 700 USDT   | 2.9%    | 20               |
| Legendary | 1000 USDT  | 3.0%    | 25               |

**Key Rules**:

- Users can invest any amount ≥ minimum
- Can buy multiple packages if eligible
- Daily earnings calculated automatically at 21:00 UTC
- Rank auto-upgrades based on investment + active referrals

## 🔗 Referral System

### Bonuses

- **One-Time Purchase**: 10% (Level 1), 3% (Level 2), 2% (Level 3)
- **Daily Income**: 10% (Level 1), 3% (Level 2), 2% (Level 3) of downline earnings

### Example

- User A invests 100 USDT
- User A's referrer (Level 1) gets 10 USDT immediately
- Level 1's referrer gets 3 USDT
- Level 1's referrer's referrer gets 2 USDT
- Plus: Daily earnings distributed at 21:00 UTC

## ⏰ Daily Cron Job (21:00 UTC)

The system automatically runs a daily cron job at 21:00 UTC to:

1. Calculate mining earnings for all active packages
2. Distribute daily referral bonuses to 3-level uplines
3. Log results in `cron_logs` table

### Setup Instructions

#### Using cron-job.org (Easiest)

1. Create account at https://cron-job.org
2. Click "Create Cron Job"
3. Fill in:
   - **Title**: `Globance Daily Mining`
   - **URL**: `https://your-domain.com/api/mining/process-daily-earnings`
   - **Method**: POST
   - **Schedule**: Daily at 21:00 UTC
   - **HTTP Header**:
     - **Name**: `x-cron-secret`
     - **Value**: Your `CRON_SECRET` from .env

#### Using AWS EventBridge

```bash
curl -X POST https://your-domain.com/api/mining/process-daily-earnings \
  -H "x-cron-secret: your-cron-secret" \
  -H "Content-Type: application/json"
```

#### Manual Test (Development)

```bash
curl -X POST http://localhost:8080/api/mining/run-daily-earnings-test
```

## 🧪 Testing

### Create Test Users

```bash
# Run seed script to create test users with referral chain
pnpm run seed:test-data
```

This creates:

- User A (no referrer)
- User B (referred by A)
- User C (referred by B)
- Admin user

### Test Package Purchase

1. Login as User B
2. Add 1000 USDT to wallet (via Supabase)
3. Buy Bronze package for 100 USDT
4. Check balances:
   - User B: 900 USDT (100 deducted)
   - User A: Should gain 10 USDT (10% bonus)

### Test Daily Mining

1. Run manual cron test:

   ```bash
   curl -X POST http://localhost:8080/api/mining/run-daily-earnings-test
   ```

2. Check `earnings_transactions` in Supabase:
   - Should see entries for mining income

3. Check `referral_bonus_transactions`:
   - Should see daily bonuses distributed to uplines

## 🚀 Deployment

### Netlify Deployment

1. Push code to GitHub
2. Connect GitHub repo to Netlify
3. Set environment variables in Netlify Dashboard
4. Deploy (Netlify automatically builds and deploys)
5. Update `APP_URL` in .env to your Netlify domain

### Replit Deployment

1. Fork/Import project to Replit
2. Create `.env` file with all variables
3. Run `pnpm install`
4. Run `pnpm dev` to start dev server
5. Replit provides public URL automatically

### Self-Hosted (VPS/Server)

1. SSH into your server
2. Clone repository
3. Create `.env` file with production variables
4. Run `pnpm install && pnpm build`
5. Run `pnpm start` (use PM2 to keep running)
6. Set up cron job (cron-job.org or system cron)

## 📊 Monitoring

### Check System Health

```bash
# Test API endpoint
curl https://your-domain.com/api/auth/me

# Check cron logs
# Go to Supabase → Table Editor → cron_logs
# You should see daily entries
```

### View Real Data

**Supabase Table Editor**:

- `users` - All registered users
- `wallets` - Balance information
- `purchases` - Mining packages bought
- `cron_logs` - Daily cron execution logs
- `earnings_transactions` - All earnings recorded
- `referral_bonus_transactions` - Referral bonuses paid

## 🐛 Troubleshooting

### Packages Not Buying

- Check user has enough balance in wallet
- Check user has enough referrals (if buying Silver/Gold)
- Check error response from API

### Referral Bonuses Not Appearing

- Confirm uplines exist in database
- Check `referral_bonus_transactions` table
- Ensure cron job has proper CRON_SECRET header

### Cron Job Not Running

- Check `cron_logs` table for entries
- Verify cron service is calling correct URL
- Verify `CRON_SECRET` header matches environment variable

### Deposits Not Crediting

- Check `deposits` table for status
- Verify NOWPayments webhook is configured
- Check `APP_URL` matches your domain

## 📝 Project Structure

```
globance/
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Packages.tsx
│   │   │   ├── P2P.tsx
│   │   │   ├── Wallet.tsx
│   │   │   └── Auth/
│   │   ├── components/
│   │   ├── api/
│   │   └── App.tsx
│   └── vite.config.ts
├── server/
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── packages.ts
│   │   ├── wallet.ts
│   │   ├── mining.ts
│   │   ├── p2p.ts
│   │   ├── webhook.ts
│   │   └── admin.ts
│   ├── utils/
│   │   ├── supabase.ts
│   │   ├── referral.ts
│   │   ├── jwt.ts
│   │   └── email.ts
│   ├── migrations/
│   │   └── 001_production_schema.sql
│   ├── scripts/
│   │   └── seed-test-data.ts
│   └── index.ts
├── package.json
├── .env.example
└── README.md
```

## 📞 Support

For issues:

1. Check this README for solutions
2. Check Supabase logs for database errors
3. Check browser console for frontend errors
4. Check Express logs for backend errors

## 📄 License

MIT License - Feel free to use this for your business

## ✨ Key Production Checklist

- [x] All package purchases fully functional
- [x] Referral system (3-level) implemented
- [x] Daily mining earnings cron job
- [x] Deposits via NOWPayments
- [x] P2P marketplace with escrow
- [x] Admin dashboard
- [x] Real data in production database
- [x] No "coming soon" features
- [x] Proper error handling
- [x] Environment variables configured
- [x] Cron job scheduled
- [x] Database migration applied

---

**Last Updated**: January 2024  
**Version**: 1.0.0 (Production Ready)
