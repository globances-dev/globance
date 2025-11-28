# 🧪 Globance Staging Environment - Complete Setup

## ✅ What's Ready

Your staging environment is **fully configured and ready to test** with:

### 🗄️ Staging Database (Supabase)
- **URL**: https://npozwanytisiwrqhqllf.supabase.co
- **Status**: ✅ 13 tables created + indexes
- **Default Data**: ✅ 6 packages + 6 P2P price ranges
- **Environment**: ISOLATED from production

### 🛠️ Mock Testing System
Complete mock endpoints for testing without real blockchain:

1. **`POST /api/debug/mock-deposit`** - Simulate USDT deposits
2. **`POST /api/debug/mock-withdrawal`** - Simulate withdrawal requests
3. **`POST /api/debug/mock-webhook`** - Simulate NOWPayments webhook
4. **`POST /api/debug/run-daily-earnings`** - Simulate cron job (run manually)
5. **`GET /api/debug/health`** - System health check
6. **`GET /api/debug/logs`** - View backend logs
7. **`POST /api/debug/clear-logs`** - Clear debug logs

### 📊 Features Enabled for Staging
- ✅ Email logging to console only (no SendGrid)
- ✅ Verbose debug logging for all transactions
- ✅ Database query logging
- ✅ Full request/response logging
- ✅ Staging badge on UI ("🧪 STAGING ENVIRONMENT")

### 📋 Test Data
Ready-to-use test users with referral chain:
- **User A** (Referrer) - test.user.a@globance.local
- **User B** (Referred by A, referrer of C) - test.user.b@globance.local
- **User C** (Referred by B) - test.user.c@globance.local
- **Admin** - test.admin@globance.local

To create test data:
```bash
npx ts-node server/scripts/seed-test-data.ts
```

---

## 🚀 Environment Variables Configured

```
ENVIRONMENT=staging
DEBUG_MODE=true
DISABLE_SENDGRID=true
STAGING_SUPABASE_URL=https://npozwanytisiwrqhqllf.supabase.co
STAGING_SUPABASE_ANON_KEY=eyJ...
STAGING_SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Production credentials also available:
```
VITE_SUPABASE_URL=https://nybdiogdfyvfklvovylw.supabase.co
NOWPAYMENTS_API_KEY=M19MR9Z...
NOWPAYMENTS_IPN_SECRET=aZyguynHEY4iZFD...
```

---

## 📚 Documentation

### Testing Guide
👉 **`STAGING_TESTING_GUIDE.md`** (882 lines)
- Phase A: Registration & Authentication
- Phase B: Wallet & Deposits
- Phase C: Cloud Mining Packages
- Phase D: Mining Earnings & Referrals
- Phase E: P2P Marketplace (Escrow)
- Phase F: Admin Panel
- Phase G: Debug Endpoints
- Phase H: Negative Test Cases
- Final Production Migration Test

### API Documentation
👉 **`BACKEND_SETUP.md`** (736 lines) - Full API reference

### Implementation Details
👉 **`IMPLEMENTATION_SUMMARY.md`** (399 lines) - Architecture overview

---

## 🎯 Next Steps: Deploy to Vercel Staging

### Option 1: Create Vercel Project (First Time)
```bash
# Install Vercel CLI
npm install -g vercel

# Login to your Vercel account
vercel login

# Create new staging project
vercel --name globance-staging --prod

# Set environment variables in Vercel dashboard
```

### Option 2: Deploy to Existing Project
```bash
vercel --prod
```

### Environment Variables on Vercel
Set these in Vercel project settings:
```
ENVIRONMENT=staging
DEBUG_MODE=true
DISABLE_SENDGRID=true
STAGING_SUPABASE_URL=https://npozwanytisiwrqhqllf.supabase.co
STAGING_SUPABASE_ANON_KEY=eyJ...
STAGING_SUPABASE_SERVICE_ROLE_KEY=eyJ...
VITE_SUPABASE_URL=https://nybdiogdfyvfklvovylw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NOWPAYMENTS_API_KEY=M19MR9Z...
NOWPAYMENTS_IPN_SECRET=aZyguynHEY4iZFD...
JWT_SECRET=c5f61b4e9f784c7b...
CRON_SECRET=your-cron-secret
```

### After Deployment
1. Update webhook URL in staging (if testing webhook): `https://staging.globance.app/api/webhook/nowpayments`
2. Verify health check: `https://staging.globance.app/api/debug/health`
3. Run test data seeding script
4. Start testing per STAGING_TESTING_GUIDE.md

---

## 🧪 Quick Testing Example

### 1. Seed Test Data
```bash
npx ts-node server/scripts/seed-test-data.ts
```

Output will provide JWT tokens for testing.

### 2. Mock Deposit
```bash
curl -X POST https://staging.globance.app/api/debug/mock-deposit \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER_A_ID",
    "amount": 50,
    "currency": "USDT",
    "network": "TRC20",
    "tx_id": "mock_tx_001"
  }'
```

### 3. Check Wallet
```bash
curl -X GET https://staging.globance.app/api/wallet/balance \
  -H "Authorization: Bearer USER_A_TOKEN"

# Response: { "usdt_balance": 50, "escrow_balance": 0 }
```

### 4. View Debug Logs
```bash
curl -X GET https://staging.globance.app/api/debug/logs

# Shows all transactions, earnings, errors
```

### 5. Run Daily Earnings
```bash
curl -X POST https://staging.globance.app/api/debug/run-daily-earnings \
  -H "Content-Type: application/json"

# Processes earnings, referral commissions
```

---

## 📊 Testing Checklist

Use `STAGING_TESTING_GUIDE.md` for detailed steps:

**Phase A: Auth (3 tests)**
- [ ] Register new user
- [ ] Login
- [ ] Get current user

**Phase B: Wallet (7 tests)**
- [ ] Get balance
- [ ] Get deposit addresses
- [ ] Mock deposit #1
- [ ] Mock deposit #2
- [ ] View deposit history
- [ ] Request withdrawal
- [ ] View withdrawal history

**Phase C: Packages (4 tests)**
- [ ] Get all packages
- [ ] Buy Bronze (no referral required)
- [ ] Try buy Silver (without referrals - should fail)
- [ ] Get user purchases

**Phase D: Mining (3 tests)**
- [ ] Run daily earnings
- [ ] Check referral commissions
- [ ] Test multi-level referrals

**Phase E: P2P (5 tests)**
- [ ] Create sell offer
- [ ] Browse offers
- [ ] Accept offer (create trade)
- [ ] Buyer marks paid
- [ ] Seller confirms (release escrow)

**Phase F: Admin (5 tests)**
- [ ] Get users
- [ ] Freeze user
- [ ] Approve withdrawal
- [ ] Set P2P price range
- [ ] View audit logs

**Phase G: Debug (3 tests)**
- [ ] Health check
- [ ] View logs
- [ ] Clear logs

**Phase H: Negative (4 tests)**
- [ ] Deposit < 5 USDT (should be pending)
- [ ] Withdraw > balance (should fail)
- [ ] Invalid P2P price (should fail)
- [ ] Frozen account login (should fail)

**Final Test (1 test)**
- [ ] Send 1 real USDT TRC20 (production)

**Total: 35 test cases**

---

## 🔒 Data Isolation

Staging is **completely isolated** from production:
- ✅ Separate Supabase project
- ✅ Separate database
- ✅ Mock deposits/withdrawals (no real blockchain)
- ✅ All emails logged to console only
- ✅ Debug endpoints only accessible in staging
- ✅ Can safely test without affecting users

---

## ⚠️ Important Notes

1. **Production Credentials Still Available**
   - Production NOWPayments API key is configured
   - But won't be used unless explicitly called
   - Staging uses mock deposit system

2. **Final Test: Real Deposit**
   - After all staging tests pass
   - Send 1 USDT TRC20 to production address
   - This confirms webhook + production setup works
   - **DO NOT** test multiple transactions on production

3. **Email in Staging**
   - All emails logged to console ONLY
   - Format: `📧 [MOCK EMAIL] Subject...`
   - No SendGrid used

4. **Debug Endpoints**
   - Only available when ENVIRONMENT=staging or DEBUG_MODE=true
   - Automatically disabled in production
   - Perfect for manual testing

---

## 📞 Quick Reference

**Staging Base URL**: `https://staging.globance.app`

**Key Endpoints**:
- Health: `GET /api/debug/health`
- Logs: `GET /api/debug/logs`
- Mock Deposit: `POST /api/debug/mock-deposit`
- Mock Withdrawal: `POST /api/debug/mock-withdrawal`
- Mock Webhook: `POST /api/debug/mock-webhook`
- Daily Earnings: `POST /api/debug/run-daily-earnings`

**Test Credentials**:
- User A: test.user.a@globance.local / TestPassword123!
- User B: test.user.b@globance.local / TestPassword123!
- User C: test.user.c@globance.local / TestPassword123!
- Admin: test.admin@globance.local / AdminPassword123!

**Supabase Staging**:
- URL: https://npozwanytisiwrqhqllf.supabase.co
- Tables: users, wallets, deposits, withdrawals, purchases, offers, trades, referrals, etc.

---

## ✨ Summary

**You now have:**
- ✅ Fully configured staging database
- ✅ 7 mock API endpoints for testing
- ✅ Complete testing guide (35 test cases)
- ✅ Test data seeding script
- ✅ Debug endpoints and logging
- ✅ Staging badge on UI
- ✅ Complete documentation

**Next:**
1. Deploy to Vercel
2. Run test data seeding
3. Follow STAGING_TESTING_GUIDE.md (Phase A-H)
4. Send 1 real USDT for final validation
5. ✅ Ready for production!

---

**Happy Testing! 🎉**

*Staging environment fully isolated. No production data at risk.*
