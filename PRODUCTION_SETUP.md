# 🚀 GLOBANCE PRODUCTION DEPLOYMENT CHECKLIST

## ✅ Pre-Deployment Setup (DO THIS FIRST)

### 1. Supabase Database (PRODUCTION "globance" PROJECT)

- [ ] Go to https://supabase.com
- [ ] Create project named "globance" OR use existing production project
- [ ] Do NOT use staging project
- [ ] Open SQL Editor
- [ ] Copy entire contents from `server/migrations/001_production_schema.sql`
- [ ] Paste and run in SQL Editor
- [ ] Wait for completion (should see all 14 tables created)
- [ ] Take screenshot showing tables exist

### 2. Environment Variables

Create `.env` file at project root with ALL these variables:

```bash
# Supabase (GET FROM PRODUCTION PROJECT)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Security Secrets (Generate using: openssl rand -base64 32)
JWT_SECRET=GENERATE_NEW_RANDOM_32_CHARS
CRON_SECRET=GENERATE_NEW_RANDOM_32_CHARS

# Payment Gateway (Production)
NOWPAYMENTS_API_KEY=your-nowpayments-api-key
NOWPAYMENTS_IPN_SECRET=your-nowpayments-ipn-secret

# Email (SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key

# Application Settings
NODE_ENV=production
APP_URL=https://your-production-domain.com
ADMIN_EMAIL=admin@your-domain.com
```

**IMPORTANT**:

- Never commit `.env` to GitHub
- All keys must be kept secret
- Use different keys for production vs staging

### 3. Environment Variable Locations

#### For Netlify:

1. Dashboard → Your Site → Site Settings
2. Build & Deploy → Environment
3. Add each variable from `.env`

#### For Replit:

1. Tools → Secrets (left sidebar)
2. Add each variable from `.env`

#### For VPS/Self-Hosted:

1. SSH into server
2. Create `.env` file in project root
3. Secure file permissions: `chmod 600 .env`

## 📦 Deployment Steps

### Option A: Deploy to Netlify (Recommended)

```bash
# 1. Push code to GitHub
git add .
git commit -m "Production: Complete referral system, P2P marketplace, daily mining"
git push origin main

# 2. Go to Netlify Dashboard
# 3. Connect GitHub repository
# 4. Set environment variables (from .env)
# 5. Build settings:
#    - Build command: pnpm install && pnpm build
#    - Publish directory: dist/spa
#    - Functions directory: netlify/functions

# 6. Deploy button → Netlify automatically builds and deploys
# 7. Wait 3-5 minutes for deployment to complete
# 8. Your app is live at: https://your-site.netlify.app
```

### Option B: Deploy to Replit

```bash
# 1. Go to https://replit.com
# 2. Click "Import from GitHub"
# 3. Paste your repo URL
# 4. Add environment variables in Secrets (left sidebar)
# 5. Run command: pnpm dev
# 6. Replit provides live URL automatically
```

### Option C: Self-Hosted (VPS)

```bash
# 1. SSH into your server
ssh user@your-server.com

# 2. Clone repository
git clone https://github.com/your-user/globance.git
cd globance

# 3. Create .env with all variables
nano .env
# Paste all variables and save

# 4. Install and build
pnpm install
pnpm build

# 5. Install PM2 for process management
npm install -g pm2

# 6. Start application
pm2 start dist/server/node-build.mjs --name "globance"

# 7. Set up auto-restart
pm2 startup
pm2 save

# 8. Configure Nginx/Apache to proxy to http://localhost:3000
```

## ⏰ Setup Daily Cron Job (21:00 UTC)

### Using cron-job.org (Free, No Setup Required)

1. Go to https://cron-job.org
2. Create free account
3. Click "Create Cron Job"
4. Fill in:
   - **Title**: Globance Daily Mining
   - **URL**: `https://your-domain.com/api/mining/process-daily-earnings`
   - **Method**: POST
   - **Authentication**: None
   - **HTTP Headers**:
     - Name: `x-cron-secret`
     - Value: Your `CRON_SECRET` from .env
   - **Execution**: Daily at 21:00 UTC

5. Click Save
6. Cron job is now active!

### Test Cron Job

```bash
# Manual test (no cron secret required)
curl -X POST https://your-domain.com/api/mining/run-daily-earnings-test

# Expected response:
# {
#   "success": true,
#   "processed": N,
#   "totalDistributed": X.XX,
#   "testMessage": "This is a TEST run..."
# }
```

## 🧪 Final Testing (BEFORE Going Live)

### Test 1: Create Test User

1. Register new account
2. Confirm user exists in Supabase → users table
3. Confirm wallet created in Supabase → wallets table

### Test 2: Manual Balance Update

1. Go to Supabase → wallets table
2. Find test user
3. Update `usdt_balance` to 1000
4. Refresh app dashboard
5. Balance should show 1000 USDT

### Test 3: Buy Package

1. Login as test user
2. Go to Packages page
3. Click "Buy Bronze Package"
4. Enter amount: 100 USDT
5. Confirm purchase
6. Check Supabase:
   - `wallets.usdt_balance` should be 900
   - `purchases` table should have new entry
   - `referral_bonus_transactions` should show bonuses (if user has referrer)

### Test 4: Create P2P Offer

1. Go to P2P Marketplace
2. Click "Create Offer"
3. Fill form:
   - Type: Buy USDT
   - Amount: 100 USDT
   - Price: 1 USD
   - Network: TRC20
   - Currency: USD
4. Click "Create Offer"
5. Confirm in Supabase → offers table

### Test 5: Manual Cron Test

1. Run: `curl -X POST https://your-domain.com/api/mining/run-daily-earnings-test`
2. Check Supabase → earnings_transactions (should have entries)
3. Check Supabase → referral_bonus_transactions (if referral chain exists)
4. Check user wallet balance increased

### Test 6: Check Admin Dashboard

1. Go to `/api/admin/cron-logs`
2. Should see cron execution records
3. Go to `/api/admin/referral-transactions`
4. Should see referral bonuses paid

## 📋 Production Checklist

### Before Going Live

- [ ] Database migration ran successfully (all 14 tables created)
- [ ] All environment variables set in hosting platform
- [ ] App deployed to production domain
- [ ] Package purchase tested with small amount
- [ ] P2P offer creation tested
- [ ] Manual cron test executed successfully
- [ ] Cron-job.org scheduled for 21:00 UTC
- [ ] Admin can access `/api/admin/` endpoints
- [ ] No "Coming Soon" messages in UI
- [ ] All buttons and forms are functional

### Post-Deployment Monitoring

- [ ] Check cron logs daily (should see entry at 21:00 UTC)
- [ ] Monitor user wallet balances
- [ ] Check for any JavaScript errors in browser console
- [ ] Monitor server logs for errors
- [ ] Confirm daily earnings are distributed
- [ ] Confirm referral bonuses are calculated correctly

## 🆘 Common Issues & Solutions

### Issue: "Database connection failed"

**Solution**: Check SUPABASE_SERVICE_ROLE_KEY is correct and copied entirely

### Issue: "Cron job not running"

**Solution**:

- Verify URL is correct and accessible
- Check cron-job.org shows last execution timestamp
- Verify x-cron-secret header is set correctly

### Issue: "Package purchase fails with 400 error"

**Solution**:

- Check user has enough balance
- Check user has enough referrals (for Silver/Gold packages)
- Check API response error message

### Issue: "Referral bonuses not appearing"

**Solution**:

- Confirm referrer exists in database
- Run manual cron test to trigger bonuses
- Check referral_bonus_transactions table directly

### Issue: "Deposits not crediting"

**Solution**:

- Verify NOWPayments API key is correct
- Check deposits table for status
- Verify webhook URL matches your domain

## 📞 Support

For deployment issues:

1. Check server logs: `pm2 logs globance` (if using PM2)
2. Check Supabase logs: Dashboard → Logs
3. Check browser console (F12 → Console tab)
4. Review error messages in API responses

## ✨ You're Production Ready!

Once all steps are complete:

- ✅ Users can register and login
- ✅ Users can buy packages with real money
- ✅ Daily earnings are calculated at 21:00 UTC
- ✅ Referral bonuses are paid automatically
- ✅ P2P marketplace is fully functional
- ✅ Admin has full visibility
- ✅ All data is secure in production Supabase

---

**Last Updated**: January 2024
**Version**: 1.0.0 - Production Ready
