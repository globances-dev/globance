# 🧪 Globance Staging Testing Guide

## Overview

This guide walks through all test scenarios for the Globance staging environment. **DO NOT** execute these on production.

**Staging Base URL**: `https://staging.globance.app` (or your Vercel staging URL)

---

## 🎯 Phase 0: Setup

### Create Test Data

Run the seeding script to create 3 test users with referral chain:

```bash
npx ts-node server/scripts/seed-test-data.ts
```

This will output:
- 3 test users (A, B, C) with referral chain
- 1 admin user
- Mock deposit addresses (TRC20 + BEP20)
- JWT tokens for testing

**Save these tokens** - you'll use them in all tests.

---

## 🟦 Phase A: User Registration & Authentication

### Test A.1: Register New User

```bash
curl -X POST https://staging.globance.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@test.local",
    "password": "TestPassword123!",
    "full_name": "New Test User",
    "ref_by": "USER_A_REF_CODE"
  }'
```

**Expected:**
```json
{
  "success": true,
  "token": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "newuser@test.local",
    "full_name": "New Test User",
    "ref_code": "UNIQUE_CODE"
  }
}
```

✅ **Check:**
- User created in database
- Unique referral code generated
- Referred by user A (if provided)
- Wallet created with 0 balance

### Test A.2: Login

```bash
curl -X POST https://staging.globance.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.user.a@globance.local",
    "password": "TestPassword123!"
  }'
```

**Expected:**
```json
{
  "success": true,
  "token": "eyJ...",
  "user": { ... }
}
```

✅ **Check:**
- JWT token returned (7-day expiration)
- Token can be used in Authorization header
- Login fails with wrong password

### Test A.3: Get Current User

```bash
curl -X GET https://staging.globance.app/api/auth/me \
  -H "Authorization: Bearer USER_A_TOKEN"
```

�� **Check:**
- Returns authenticated user details
- Token validation works

---

## 🟩 Phase B: Wallet & Deposits

### Test B.1: Get Wallet Balance

```bash
curl -X GET https://staging.globance.app/api/wallet/balance \
  -H "Authorization: Bearer USER_A_TOKEN"
```

**Expected:**
```json
{
  "usdt_balance": 0,
  "escrow_balance": 0
}
```

✅ **Check:**
- Returns current balance (should be 0 initially)
- Escrow balance tracked separately

### Test B.2: Get Deposit Addresses

```bash
curl -X GET https://staging.globance.app/api/wallet/deposit-addresses \
  -H "Authorization: Bearer USER_A_TOKEN"
```

**Expected:**
```json
{
  "addresses": [
    {
      "network": "TRC20",
      "address": "mock_trc20_xxx"
    },
    {
      "network": "BEP20",
      "address": "mock_bep20_xxx"
    }
  ]
}
```

✅ **Check:**
- Both TRC20 and BEP20 addresses exist
- Addresses are permanent (same on each call)
- Addresses are unique per user

### Test B.3: Mock Deposit - 50 USDT (TRC20)

```bash
curl -X POST https://staging.globance.app/api/debug/mock-deposit \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER_A_ID",
    "amount": 50,
    "currency": "USDT",
    "network": "TRC20",
    "tx_id": "mock_tx_12345"
  }'
```

**Expected:**
```json
{
  "success": true,
  "deposit": {
    "id": "uuid",
    "amount": 50,
    "network": "TRC20",
    "status": "confirmed",
    "tx_id": "mock_tx_12345"
  }
}
```

✅ **Verify:**
- Check wallet balance increased to 50 USDT
- Check deposit in GET /api/wallet/deposit-history
- Check console log shows "[MOCK EMAIL] Deposit Confirmation"
- Check /api/debug/logs shows "Wallet updated: +50 USDT"

### Test B.4: Mock Deposit - 75 USDT (BEP20)

```bash
curl -X POST https://staging.globance.app/api/debug/mock-deposit \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER_A_ID",
    "amount": 75,
    "currency": "USDT",
    "network": "BEP20",
    "tx_id": "mock_tx_67890"
  }'
```

✅ **Verify:**
- Wallet balance increased to 125 USDT (50 + 75)
- Deposit appears in history
- BEP20 network recorded

### Test B.5: Get Deposit History

```bash
curl -X GET https://staging.globance.app/api/wallet/deposit-history \
  -H "Authorization: Bearer USER_A_TOKEN"
```

**Expected:**
```json
{
  "deposits": [
    {
      "amount": 50,
      "network": "TRC20",
      "status": "confirmed",
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "amount": 75,
      "network": "BEP20",
      "status": "confirmed",
      "created_at": "2024-01-15T10:35:00Z"
    }
  ]
}
```

✅ **Check:**
- Both deposits appear in reverse chronological order
- Status = "confirmed"
- Amounts match

### Test B.6: Withdrawal Request

```bash
curl -X POST https://staging.globance.app/api/wallet/withdrawal-request \
  -H "Authorization: Bearer USER_A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 25,
    "address": "T_user_address_12345",
    "network": "TRC20"
  }'
```

**Expected:**
```json
{
  "success": true,
  "withdrawal": {
    "id": "uuid",
    "amount": 25,
    "network": "TRC20",
    "address": "T_user_address_12345",
    "status": "pending"
  }
}
```

✅ **Verify:**
- Withdrawal status = "pending"
- Wallet balance reduced to 100 USDT (125 - 25)
- Console shows "[MOCK EMAIL] Withdrawal Request"

### Test B.7: Get Withdrawal History

```bash
curl -X GET https://staging.globance.app/api/wallet/withdrawal-history \
  -H "Authorization: Bearer USER_A_TOKEN"
```

✅ **Check:**
- Withdrawal appears with status = "pending"

---

## 🟪 Phase C: Cloud Mining Packages

### Test C.1: Get All Packages

```bash
curl -X GET https://staging.globance.app/api/packages
```

**Expected:**
```json
{
  "packages": [
    { "name": "Bronze", "min_amount": 10, "daily_percent": 2.5, "referral_required": 0 },
    { "name": "Silver", "min_amount": 100, "daily_percent": 2.6, "referral_required": 5 },
    { "name": "Gold", "min_amount": 300, "daily_percent": 2.7, "referral_required": 10 },
    ...
  ]
}
```

✅ **Check:**
- All 6 packages present
- Correct min amounts and daily percentages
- Referral requirements set

### Test C.2: Buy Bronze Package (No Referral Required)

User A has 100 USDT. Buy Bronze (min 10 USDT).

```bash
curl -X POST https://staging.globance.app/api/packages/buy \
  -H "Authorization: Bearer USER_A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "package_id": "BRONZE_PACKAGE_ID"
  }'
```

**Expected:**
```json
{
  "success": true,
  "purchase": {
    "id": "uuid",
    "package_id": "uuid",
    "amount": 10,
    "daily_percent": 2.5,
    "duration_days": 270
  }
}
```

✅ **Verify:**
- Purchase created
- Wallet balance reduced to 90 USDT
- Purchase appears in GET /api/packages/user/purchases

### Test C.3: Buy Silver Package (Requires 5 Referrals)

User B has 100 USDT. Try to buy Silver without 5 referrals.

```bash
curl -X POST https://staging.globance.app/api/packages/buy \
  -H "Authorization: Bearer USER_B_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "package_id": "SILVER_PACKAGE_ID"
  }'
```

**Expected:**
```json
{
  "error": "Need 5 active referrals to buy this package"
}
```

✅ **Check:**
- Hybrid rule enforced
- User cannot bypass referral requirement

### Test C.4: Get Active Purchases

```bash
curl -X GET https://staging.globance.app/api/packages/user/purchases \
  -H "Authorization: Bearer USER_A_TOKEN"
```

**Expected:**
```json
{
  "purchases": [
    {
      "id": "uuid",
      "package_id": "uuid",
      "amount": 10,
      "accrued_earnings": 0.25,
      "daily_earning": 0.25,
      "status": "active"
    }
  ]
}
```

✅ **Check:**
- Purchase shows with accrued earnings
- Daily earning calculated: 10 * 2.5% = 0.25 USDT/day
- Status = "active"

---

## 🟥 Phase D: Mining Earnings & Referrals

### Test D.1: Run Daily Earnings (Simulate Cron)

```bash
curl -X POST https://staging.globance.app/api/debug/run-daily-earnings \
  -H "Content-Type: application/json"
```

**Expected:**
```json
{
  "success": true,
  "processed": 1
}
```

✅ **Verify:**
- Check User A wallet: should be ~90.25 USDT (90 + 0.25 earnings)
- Check /api/debug/logs for earning credits
- Check referral commission to User B (Level 1: 10% of 0.25 = 0.025 USDT)

### Test D.2: Check Referral Commissions

Deposit 100 USDT to User B:

```bash
curl -X POST https://staging.globance.app/api/debug/mock-deposit \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER_B_ID",
    "amount": 100,
    "currency": "USDT",
    "network": "TRC20",
    "tx_id": "mock_tx_user_b"
  }'
```

User B buys Bronze package:

```bash
curl -X POST https://staging.globance.app/api/packages/buy \
  -H "Authorization: Bearer USER_B_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "package_id": "BRONZE_PACKAGE_ID"
  }'
```

✅ **Verify:**
- User B wallet reduced from 100 to 90 USDT (purchase 10)
- User A receives referral bonus: 10 * 10% = 1 USDT
- Check /api/debug/logs for commission processing

### Test D.3: Multi-Level Referral Chain

Deposit 100 USDT to User C:

```bash
curl -X POST https://staging.globance.app/api/debug/mock-deposit \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER_C_ID",
    "amount": 100,
    "currency": "USDT",
    "network": "TRC20",
    "tx_id": "mock_tx_user_c"
  }'
```

User C buys Bronze:

```bash
curl -X POST https://staging.globance.app/api/packages/buy \
  -H "Authorization: Bearer USER_C_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "package_id": "BRONZE_PACKAGE_ID"
  }'
```

✅ **Verify:**
- User B (L1 referrer) gets: 10 * 10% = 1 USDT
- User A (L2 referrer) gets: 10 * 3% = 0.3 USDT
- User C balance reduced by 10 USDT

---

## 🟧 Phase E: P2P Marketplace (Escrow)

### Test E.1: Create SELL Offer

User A creates sell offer for 20 USDT at 175 ETB/USDT:

```bash
curl -X POST https://staging.globance.app/api/p2p/offers \
  -H "Authorization: Bearer USER_A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sell",
    "amount": 20,
    "price": 175,
    "network": "TRC20",
    "fiat_currency": "ETB",
    "country": "Ethiopia",
    "payment_method": "Bank Transfer",
    "min_limit": 5,
    "max_limit": 100,
    "margin": 0
  }'
```

**Expected:**
```json
{
  "success": true,
  "offer": {
    "id": "uuid",
    "type": "sell",
    "amount": 20,
    "price": 175,
    "status": "active"
  }
}
```

✅ **Check:**
- Offer created with status = "active"
- Price within range (170-180 ETB for staging)

### Test E.2: Browse Offers

```bash
curl -X GET "https://staging.globance.app/api/p2p/offers?type=sell&currency=ETB"
```

✅ **Check:**
- User A's offer appears in marketplace
- Can filter by type, currency, network

### Test E.3: Accept Offer (Create Trade)

User B buys from User A:

```bash
curl -X POST https://staging.globance.app/api/p2p/accept-offer \
  -H "Authorization: Bearer USER_B_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "offer_id": "USER_A_OFFER_ID",
    "amount": 10
  }'
```

**Expected:**
```json
{
  "success": true,
  "trade": {
    "id": "uuid",
    "buyer_id": "USER_B_ID",
    "seller_id": "USER_A_ID",
    "amount": 10,
    "escrow": 10,
    "status": "pending"
  }
}
```

✅ **Verify:**
- Trade created with status = "pending"
- Escrow = 10 (seller's USDT locked)
- User A's escrow balance increased by 10
- User A's available balance decreased by 10

### Test E.4: Mark Payment Sent (Buyer)

User B marks payment sent to User A:

```bash
curl -X POST https://staging.globance.app/api/p2p/trades/TRADE_ID/mark-paid \
  -H "Authorization: Bearer USER_B_TOKEN"
```

**Expected:**
```json
{
  "success": true,
  "trade": {
    "status": "paid"
  }
}
```

✅ **Check:**
- Trade status changed to "paid"
- Console shows "[MOCK EMAIL] Buyer marked payment received"

### Test E.5: Confirm Receipt (Seller)

User A confirms payment received:

```bash
curl -X POST https://staging.globance.app/api/p2p/trades/TRADE_ID/confirm-received \
  -H "Authorization: Bearer USER_A_TOKEN"
```

**Expected:**
```json
{
  "success": true,
  "trade": {
    "status": "completed"
  }
}
```

✅ **Verify:**
- Trade status = "completed"
- Escrow (10 USDT) released to User B's balance
- User A's escrow balance decreased by 10
- User B's balance increased by 10
- Console shows "[MOCK EMAIL] Trade completed"

---

## 🟨 Phase F: Admin Panel

### Test F.1: Get All Users (Admin)

```bash
curl -X GET "https://staging.globance.app/api/admin/users" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Expected:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "test.user.a@globance.local",
      "full_name": "Test User A",
      "role": "user",
      "wallets": [{ "usdt_balance": 100 }]
    },
    ...
  ]
}
```

✅ **Check:**
- All users visible to admin
- Can search by email

### Test F.2: Freeze User Account

```bash
curl -X POST https://staging.globance.app/api/admin/users/USER_A_ID/freeze \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "is_frozen": true }'
```

✅ **Verify:**
- User A is_frozen = true
- User A cannot login
- Audit log records action

### Test F.3: Approve Withdrawal

Get pending withdrawals:

```bash
curl -X GET https://staging.globance.app/api/admin/withdrawals/pending \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

Execute withdrawal:

```bash
curl -X POST https://staging.globance.app/api/admin/withdrawals/WITHDRAWAL_ID/execute \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_txid": "mock_payout_123"
  }'
```

✅ **Verify:**
- Withdrawal status changed to "executed"
- Console shows "[MOCK EMAIL] Withdrawal executed"
- Audit log recorded

### Test F.4: Set P2P Price Range

```bash
curl -X POST https://staging.globance.app/api/admin/p2p-price-ranges \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fiat_currency": "ETB",
    "min_price": 160,
    "max_price": 190
  }'
```

✅ **Check:**
- Price range updated
- New offers validated against range
- Audit log recorded

### Test F.5: View Audit Logs

```bash
curl -X GET https://staging.globance.app/api/admin/audit-logs \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

✅ **Check:**
- All admin actions recorded
- Includes: user freeze, withdrawal, price range changes
- Timestamps accurate

---

## 🟩 Phase G: Debug Endpoints

### Test G.1: Health Check

```bash
curl -X GET https://staging.globance.app/api/debug/health
```

**Expected:**
```json
{
  "status": "healthy",
  "environment": "staging",
  "database": "connected",
  "stats": {
    "users": 3,
    "deposits": 5,
    "purchases": 2
  }
}
```

### Test G.2: View Debug Logs

```bash
curl -X GET https://staging.globance.app/api/debug/logs
```

✅ **Check:**
- Last 100 debug logs returned
- Shows all deposits, earnings, errors
- Timestamps and log levels

### Test G.3: Clear Debug Logs

```bash
curl -X POST https://staging.globance.app/api/debug/clear-logs
```

---

## 🔴 Phase H: Negative Test Cases (Safety)

### Test H.1: Deposit Below Minimum (< 5 USDT)

```bash
curl -X POST https://staging.globance.app/api/debug/mock-deposit \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER_ID",
    "amount": 2,
    "currency": "USDT",
    "network": "TRC20",
    "tx_id": "tiny_deposit"
  }'
```

✅ **Expected:** Status = "pending" (not credited immediately)

### Test H.2: Withdraw More Than Balance

User with 50 USDT tries to withdraw 100 USDT:

```bash
curl -X POST https://staging.globance.app/api/wallet/withdrawal-request \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "amount": 100, "address": "T_addr", "network": "TRC20" }'
```

✅ **Expected:** `{ "error": "Insufficient balance" }`

### Test H.3: Invalid P2P Price

Try to create offer at 200 ETB (outside 170-180 range):

```bash
curl -X POST https://staging.globance.app/api/p2p/offers \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sell",
    "amount": 10,
    "price": 200,
    "fiat_currency": "ETB",
    ...
  }'
```

✅ **Expected:** `{ "error": "Price must be between 170 and 180" }`

### Test H.4: Frozen Account Cannot Login

```bash
curl -X POST https://staging.globance.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "frozen_user@test.local", "password": "Password123!" }'
```

✅ **Expected:** `{ "error": "Account is frozen" }`

---

## ✅ Final Production Migration Test

Once ALL tests pass:

### Send 1 Real USDT (TRC20)

1. Copy User A's real TRC20 deposit address from production wallet
2. Send exactly 1 USDT from your wallet via NOWPayments
3. Wait for confirmation (5-10 minutes)
4. Check webhook received and processed
5. Verify balance updated
6. Check email logged to console

**If this succeeds → Production is safe! 🚀**

---

## 📋 Testing Checklist

- [ ] Phase A: Registration & Auth (3 tests)
- [ ] Phase B: Wallet & Deposits (7 tests)
- [ ] Phase C: Packages (4 tests)
- [ ] Phase D: Mining & Referrals (3 tests)
- [ ] Phase E: P2P Marketplace (5 tests)
- [ ] Phase F: Admin Panel (5 tests)
- [ ] Phase G: Debug Endpoints (3 tests)
- [ ] Phase H: Negative Cases (4 tests)
- [ ] Final Production Test (1 real deposit)

**Total: 35 test cases**

---

## 🆘 Troubleshooting

### Issue: 404 on /api/debug endpoints
- ✅ Check: ENVIRONMENT=staging in env vars
- ✅ Check: DEBUG_MODE=true in env vars

### Issue: Deposits not crediting
- ✅ Check: /api/debug/logs for errors
- ✅ Check: Supabase deposits table
- ✅ Run: GET /api/debug/health

### Issue: Referral commissions not working
- ✅ Check: User B's ref_by = User A ID
- ✅ Check: Run mining earnings endpoint
- ✅ Check: View referrals table in Supabase

---

## 📞 Support

- **Logs**: https://staging.globance.app/api/debug/logs
- **Health**: https://staging.globance.app/api/debug/health
- **Supabase Console**: Check deposits, wallets, purchases tables

---

**Happy Testing! 🎉**
