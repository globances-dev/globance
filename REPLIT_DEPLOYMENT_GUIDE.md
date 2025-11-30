# 🚀 Globance - Replit Deployment Guide

## ✅ Current Status: PRODUCTION READY

Your Globance platform is **fully configured** and ready for deployment on Replit!

---

## 📋 What's Been Configured

### ✅ Project Structure
- **Frontend**: React + Vite (client/)
- **Backend**: Express API (server/)
- **Database**: Supabase (Supabase)
- **Build System**: Dual build (client + server)
- **Production Server**: Optimized for Replit Deployments

### ✅ All API Endpoints Working
```
Authentication:
✓ POST /api/auth/register
✓ POST /api/auth/login
✓ GET /api/auth/me

Wallet:
✓ GET /api/wallet/balance
✓ GET /api/wallet/deposit-addresses
✓ GET /api/wallet/deposit-history
✓ POST /api/wallet/withdrawal-request

Packages:
✓ GET /api/packages
✓ POST /api/packages/buy
✓ GET /api/packages/user/purchases

Mining:
✓ POST /api/mining/process-daily-earnings (cron protected)
✓ POST /api/mining/run-daily-earnings-test

P2P Marketplace:
✓ GET /api/p2p/offers
✓ POST /api/p2p/offers
✓ POST /api/p2p/accept-offer
✓ GET /api/p2p/my-trades

Webhooks:
✓ POST /api/webhook/nowpayments (raw body parsing)

Admin:
✓ GET /api/admin/users
✓ GET /api/admin/cron-logs
✓ GET /api/admin/referral-tree/:userId
✓ (+ 15 more admin endpoints)
```

### ✅ Production Build
- Client builds to: `dist/spa/`
- Server builds to: `dist/server/`
- Production command: `npm start` → runs `node dist/server/node-build.mjs`

---

## 🎯 Deployment Steps

### Step 1: Build for Production

The build process is already configured. To build:

```bash
npm run build
```

This runs:
1. `npm run build:client` - Builds React frontend
2. `npm run build:server` - Builds Express backend

### Step 2: Deploy on Replit

Your deployment is already configured:

- **Type**: Autoscale (always-on when requests come in)
- **Build Command**: `npm run build`
- **Run Command**: `node dist/server/node-build.mjs`
- **Port**: Auto-detected (uses process.env.PORT)

**To Deploy:**
1. Click the "Deploy" button in Replit
2. Choose "Autoscale" deployment
3. Replit will automatically:
   - Run the build command
   - Start the production server
   - Provide you with a live URL

### Step 3: Set Environment Variables in Deployment

Go to Replit Deployment Settings → Secrets and add:

```bash
VITE_SUPABASE_URL=<YOUR_SUPABASE_PROJECT_URL>
VITE_SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<YOUR_SUPABASE_SERVICE_ROLE_KEY>
JWT_SECRET=<GENERATE_STRONG_32_CHAR_SECRET>
CRON_SECRET=<GENERATE_STRONG_32_CHAR_SECRET>
NOWPAYMENTS_API_KEY=<YOUR_NOWPAYMENTS_API_KEY>
NOWPAYMENTS_IPN_SECRET=<YOUR_NOWPAYMENTS_IPN_SECRET>
SENDGRID_API_KEY=<YOUR_SENDGRID_API_KEY>
APP_URL=https://<YOUR_DEPLOYMENT_NAME>.repl.co
NODE_ENV=production
ADMIN_EMAIL=<YOUR_ADMIN_EMAIL>
ENVIRONMENT=production
DISABLE_SENDGRID=false
DEBUG_MODE=false
```

**⚠️ CRITICAL SECURITY**:
- **NEVER** use the same secrets from development in production
- Generate new secrets using: `openssl rand -base64 32`
- Keep production secrets in Replit Secrets only (never commit them)
- Your Supabase keys are from your Supabase Dashboard → Settings → API
- Get NOWPayments keys from NOWPayments Dashboard → Settings
- Get SendGrid API key from SendGrid Dashboard → Settings → API Keys

---

## 🕐 Setting Up Daily Cron Job (21:00 UTC)

### Using cron-job.org (Recommended)

1. **Sign up at https://cron-job.org**

2. **Create a new Cron Job**:
   - Title: `Globance Daily Mining Earnings`
   - URL: `https://your-deployment-url.repl.co/api/mining/process-daily-earnings`
   - Method: `POST`
   - Schedule: Daily at 21:00 UTC
   - Execution schedule: `0 21 * * *`

3. **Add HTTP Header**:
   - Header Name: `x-cron-secret`
   - Header Value: Your `CRON_SECRET` from environment variables

4. **Save and Enable**

### Alternative: AWS EventBridge

Create a rule that calls your endpoint daily with the secret header.

### Test the Cron Endpoint

```bash
curl -X POST https://your-deployment-url.repl.co/api/mining/process-daily-earnings \
  -H "x-cron-secret: your-cron-secret" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "processed": 5,
  "failed": 0,
  "totalDistributed": 12.5
}
```

---

## 💰 Setting Up NOWPayments Webhook

1. **Log into your NOWPayments Dashboard**

2. **Go to Settings → API**

3. **Set IPN Callback URL**:
   ```
   https://your-deployment-url.repl.co/api/webhook/nowpayments
   ```

4. **Verify IPN Secret Matches**:
   - Your deployment environment variable `NOWPAYMENTS_IPN_SECRET` must match
   - The secret shown in NOWPayments dashboard

5. **Test the Webhook**:
   - NOWPayments has a "Send Test IPN" feature
   - Check your Supabase `deposits` table for the test transaction

### Webhook Security

The webhook endpoint:
- ✅ Parses raw body for signature verification
- ✅ Validates IPN signature using your secret
- ✅ Prevents duplicate deposits (idempotency)
- ✅ Updates wallet balances atomically
- ✅ Logs all deposits to audit trail

---

## 🗄️ Database Configuration

Your Supabase database is already configured:

**Production Database**:
- URL: `https://nybdiogdfyvfklvovylw.supabase.co`
- Status: ✅ Connected

**Tables**:
- users, wallets, packages, purchases
- deposits, deposit_addresses
- offers, trades
- earnings_transactions, referral_bonus_transactions
- cron_logs, audit_logs

**Migrations**:
- Schema is in: `server/migrations/001_production_schema.sql`
- Already applied to production database

---

## 🧪 Testing Your Deployment

### 1. Test Frontend
Visit: `https://your-deployment-url.repl.co/`

You should see:
- ✅ Globance homepage
- ✅ Navigation (Dashboard, Packages, P2P Marketplace, Wallet)
- ✅ Login/Register buttons

### 2. Test API Endpoints

```bash
# Health check
curl https://your-deployment-url.repl.co/api/ping

# Get packages (no auth required)
curl https://your-deployment-url.repl.co/api/packages

# Test registration
curl -X POST https://your-deployment-url.repl.co/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","full_name":"Test User"}'
```

### 3. Test Cron Endpoint

```bash
curl -X POST https://your-deployment-url.repl.co/api/mining/process-daily-earnings \
  -H "x-cron-secret: your-cron-secret"
```

### 4. Monitor Cron Logs

Go to Supabase → Table Editor → `cron_logs` to see execution history.

---

## 📊 Monitoring & Maintenance

### Daily Checks

1. **Cron Logs**: Check `cron_logs` table daily
   ```sql
   SELECT * FROM cron_logs ORDER BY timestamp DESC LIMIT 10;
   ```

2. **Failed Transactions**: Monitor for errors
   ```sql
   SELECT * FROM deposits WHERE status = 'failed';
   ```

3. **User Balances**: Verify wallet integrity
   ```sql
   SELECT SUM(usdt_balance) as total_balance FROM wallets;
   ```

### Replit Monitoring

- Check Deployment Logs for errors
- Monitor CPU/Memory usage
- Set up uptime monitoring (UptimeRobot, Pingdom)

---

## 🔒 Security Checklist

- ✅ JWT_SECRET is strong (32+ characters)
- ✅ CRON_SECRET protects daily earnings endpoint
- ✅ NOWPAYMENTS_IPN_SECRET validates webhooks
- ✅ SUPABASE_SERVICE_ROLE_KEY is never exposed to client
- ✅ All API routes require authentication except public endpoints
- ✅ Admin routes require admin role
- ✅ Environment variables are in Replit Secrets (encrypted)

---

## 💡 Development vs Production

### Development (Current Workflow)
```bash
npm run dev
```
- Runs Vite dev server on port 5000
- Express backend embedded via Vite plugin
- Hot Module Replacement enabled
- Access at: https://your-repl.repl.co

### Production (After Deployment)
```bash
npm run build  # Build both client and server
npm start      # Run production server
```
- Serves built React app from `dist/spa/`
- Express backend serves API + static files
- Optimized and minified
- Access at: https://your-deployment-url.repl.co

---

## 🚨 Troubleshooting

### Build Fails
```bash
# Clear dependencies and reinstall
rm -rf node_modules dist
npm install
npm run build
```

### Deployment Not Starting
- Check Replit Deployment Logs
- Verify environment variables are set
- Ensure PORT is not hardcoded (use process.env.PORT)

### Webhook Not Receiving Events
- Verify IPN URL is correct
- Check IPN secret matches
- Test with NOWPayments "Send Test IPN"
- Check Replit deployment logs for incoming requests

### Cron Job Not Running
- Verify cron-job.org is active
- Check CRON_SECRET matches
- Test endpoint manually
- Check `cron_logs` table for entries

### Database Connection Issues
- Verify Supabase credentials
- Check if database is active
- Test connection in Supabase dashboard
- Verify service_role key is correct

---

## 📞 Support Resources

**Replit**:
- Docs: https://docs.replit.com
- Support: support@replit.com

**Supabase**:
- Docs: https://supabase.com/docs
- Dashboard: https://app.supabase.com

**NOWPayments**:
- Docs: https://documenter.getpostman.com/view/7907941/S1a32n38
- Support: support@nowpayments.io

---

## 🎉 You're Ready to Deploy!

Your Globance platform is fully configured and production-ready on Replit.

**Next Steps**:
1. Click "Deploy" in Replit
2. Configure cron job at cron-job.org
3. Set up NOWPayments webhook
4. Test all endpoints
5. Monitor the first 24 hours closely

**Your deployment will be live at**:
`https://your-deployment-name.repl.co`

Good luck with your cloud mining platform! 🚀
