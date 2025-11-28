# Globance Referral System - Complete Implementation Guide

## Overview

This document outlines the complete referral and package eligibility system for Globance platform, implementing a 3-level referral structure with automatic rank upgrades based on investment and active referrals.

## System Components

### 1. Package Structure

Six investment packages with increasing returns and requirements:

| Package   | Min Invest | Daily % | Referrals Required |
| --------- | ---------- | ------- | ------------------ |
| Bronze    | 10 USDT    | 2.5%    | 0                  |
| Silver    | 100 USDT   | 2.6%    | 5                  |
| Gold      | 300 USDT   | 2.7%    | 10                 |
| Platinum  | 500 USDT   | 2.8%    | 15                 |
| Diamond   | 700 USDT   | 2.9%    | 20                 |
| Legendary | 1000 USDT  | 3.0%    | 25                 |

**Key Rules:**

- Users can invest ANY amount >= minimum (no maximum)
- Users can purchase multiple packages as long as they meet eligibility
- All investments contribute to both daily earnings and rank calculation
- Active = has at least one active package

### 2. Referral Reward Structure

#### A. One-Time Purchase Bonus (Immediate)

When a user invests in a package, their referral uplines receive:

- **Level 1 (Direct Sponsor)**: 10% of investment amount
- **Level 2 (Sponsor's Sponsor)**: 3% of investment amount
- **Level 3 (Level 2's Sponsor)**: 2% of investment amount

_Example: User invests 1000 USDT_

- Level 1 receives: 100 USDT immediately
- Level 2 receives: 30 USDT immediately
- Level 3 receives: 20 USDT immediately

#### B. Daily Referral Income (Automatic at 21:00 UTC)

When a user earns daily mining income, their uplines receive a percentage:

- **Level 1**: 10% of daily mining income
- **Level 2**: 3% of daily mining income
- **Level 3**: 2% of daily mining income

_Example: User's daily mining income = 100 USDT_

- Level 1 receives: 10 USDT daily
- Level 2 receives: 3 USDT daily
- Level 3 receives: 2 USDT daily

### 3. Auto-Upgrade Rank System

A user's **current rank** is automatically calculated based on:

1. **Total invested amount** across all active packages
2. **Number of active direct referrals** (users with this user as sponsor who have at least one active package)

**Calculation:**
The system checks from highest to lowest rank and assigns the highest rank for which the user qualifies:

- Total invested >= package minimum AND
- Active direct referrals >= package requirement

**Example Flow:**

1. User invests 1000 USDT in Bronze → Rank = Bronze (0 referrals needed)
2. User gains 5 direct referrals with packages → Rank = Silver (100+ invested + 5 referrals)
3. User gains 10 direct referrals with packages → Rank = Gold (300+ invested + 10 referrals)

**When Rank Updates:**

- After each new package purchase
- When a new direct referral purchases a package
- Via admin endpoint `/admin/recalculate-rank/:userId`

### 4. Package Eligibility

To purchase a package, user must:

1. Have investment amount >= package minimum
2. Have active direct referrals >= package requirement (if not Bronze)
3. Have sufficient USDT balance

**Validation happens on:**

- Package purchase request
- Eligibility is checked before deducting funds

## Database Schema

### New Tables

#### `referral_bonus_transactions`

Tracks all referral bonuses (one-time and daily):

```sql
- id (UUID)
- from_user_id (UUID) - user who made the investment
- to_user_id (UUID) - user receiving the bonus
- amount (DECIMAL)
- level (INTEGER: 1, 2, 3)
- type (VARCHAR: 'one_time_purchase', 'daily_referral_income')
- package_id (VARCHAR)
- created_at (TIMESTAMP)
```

#### `earnings_transactions`

Tracks all earnings (mining income and investments):

```sql
- id (UUID)
- user_id (UUID)
- package_id (VARCHAR)
- amount (DECIMAL)
- type (VARCHAR: 'daily_mining_income', 'investment')
- created_at (TIMESTAMP)
```

#### `cron_logs`

Tracks daily cron job execution for idempotency:

```sql
- id (UUID)
- process_type (VARCHAR: 'daily_earnings')
- process_date (DATE)
- purchases_processed (INTEGER)
- total_distributed (DECIMAL)
- failed_count (INTEGER)
- failed_purchases (TEXT)
- timestamp (TIMESTAMP)
```

### Modified Tables

#### `users`

Add new column:

- `current_rank` (VARCHAR, default: 'Bronze') - user's current calculated rank

#### `purchases`

Add new column:

- `total_earned` (DECIMAL, default: 0) - cumulative earnings from this package

## API Endpoints

### User Endpoints

#### Buy Package

```
POST /api/packages/buy
Body: {
  "package_id": "bronze|silver|gold|platinum|diamond|legendary",
  "amount": 1000  // optional, defaults to package minimum
}
Response: {
  "success": true,
  "purchase": {
    "id": "...",
    "package_id": "...",
    "amount": 1000,
    "daily_percent": 2.5,
    "duration_days": 270
  }
}
```

#### Get User Profile

```
GET /api/auth/me
Response: {
  "user": {
    "id": "...",
    "email": "...",
    "full_name": "...",
    "current_rank": "Silver",
    "ref_code": "...",
    "role": "user"
  }
}
```

### Admin Endpoints

#### View Referral Tree (3 levels)

```
GET /admin/referral-tree/:userId
Response: {
  "user": { id, email, full_name, current_rank },
  "referralTree": [
    {
      "id": "...",
      "email": "...",
      "full_name": "...",
      "current_rank": "Bronze",
      "referrals": [
        {
          "id": "...",
          "email": "...",
          "referrals": [...]
        }
      ]
    }
  ],
  "totalDirectReferrals": 5
}
```

#### Get User Referral Statistics

```
GET /admin/referral-stats/:userId
Response: {
  "user": { id, email, full_name, current_rank },
  "rankInfo": {
    "current_rank": "Silver",
    "total_invested": 5000,
    "active_referral_count": 5,
    "highest_qualified_rank": "Silver"
  },
  "activePackages": 2,
  "referralBonuses": {
    "total": 1500.50,
    "byType": {
      "one_time_purchase": 1000,
      "daily_referral_income": 500.50
    },
    "transactionCount": 45
  }
}
```

#### View Referral Transactions

```
GET /admin/referral-transactions?type=one_time_purchase&limit=100&offset=0
Response: {
  "transactions": [...],
  "total": 245,
  "limit": 100,
  "offset": 0
}
```

#### View Earnings Transactions

```
GET /admin/earnings-transactions?type=daily_mining_income&limit=100&offset=0
Response: {
  "transactions": [...],
  "total": 1024,
  "limit": 100,
  "offset": 0
}
```

#### View Cron Logs

```
GET /admin/cron-logs?limit=50
Response: {
  "logs": [
    {
      "process_type": "daily_earnings",
      "process_date": "2024-01-15",
      "purchases_processed": 42,
      "total_distributed": 15234.50,
      "failed_count": 0,
      "timestamp": "2024-01-15T21:00:00Z"
    }
  ]
}
```

#### Manually Recalculate User Rank

```
POST /admin/recalculate-rank/:userId
Response: {
  "success": true,
  "userId": "...",
  "newRank": "Gold"
}
```

## Daily Cron Job

### Execution

- **Time**: 21:00 UTC (9:00 PM UTC) daily
- **Method**: HTTP POST to `/api/mining/process-daily-earnings`
- **Header Required**: `x-cron-secret` with value from `CRON_SECRET` environment variable

### What It Does

For each active purchase:

1. **Calculate Daily Mining Income**
   - `daily_income = invested_amount * (daily_percent / 100)`

2. **Credit User**
   - Add `daily_income` to user's main balance
   - Record transaction in `earnings_transactions`

3. **Distribute Referral Bonuses**
   - If user has Level 1 upline: credit 10% of daily_income
   - If user has Level 2 upline: credit 3% of daily_income
   - If user has Level 3 upline: credit 2% of daily_income
   - Record each transaction in `referral_bonus_transactions`

### Idempotency

The system ensures it only runs once per day by:

- Checking `cron_logs` table for `process_date` matching today
- If already processed, return early with no updates
- All successful runs are logged for auditing

### Setup Instructions

Using a cron service (e.g., AWS EventBridge, Google Cloud Scheduler, or cron-job.org):

```bash
curl -X POST https://your-app.com/api/mining/process-daily-earnings \
  -H "x-cron-secret: your_cron_secret_from_env" \
  -H "Content-Type: application/json"
```

## Setup Instructions

### 1. Database Migration

1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the contents of `server/migrations/001_add_referral_system_tables.sql`
4. Execute the SQL
5. Verify tables are created

### 2. Environment Variables

Ensure these are set:

```
CRON_SECRET=your-secure-cron-secret-key
VITE_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Deploy Code

1. Push the updated code to your repository
2. Deploy to production/staging
3. Test the endpoints

### 4. Test Referral Flow

**Via Test Script:**

```bash
npm run seed:test-data
```

This creates:

- User A (no referrer)
- User B (referred by A)
- User C (referred by B)
- Test wallets with 0 balance

**Manual Testing:**

1. Register User A
2. Register User B with User A's ref_code
3. Add balance to User B's wallet (admin or test endpoint)
4. User B buys a package → User A should receive bonus
5. Run cron job → Daily earnings distributed to A and uplines

## Key Implementation Files

- `server/utils/referral.ts` - Core referral logic
- `server/routes/packages.ts` - Package purchase with eligibility
- `server/routes/mining.ts` - Daily cron job
- `server/routes/admin.ts` - Admin endpoints for visibility
- `server/routes/auth.ts` - User registration/login with rank
- `server/migrations/001_add_referral_system_tables.sql` - Database schema

## Troubleshooting

### Issue: "Need X referrals to buy package"

- User doesn't have enough active direct referrals
- Check: Are referrals registered and have they purchased a package?
- Admin endpoint: GET `/admin/referral-tree/:userId`

### Issue: Referral bonuses not appearing

- Check cron job is running at 21:00 UTC
- Check `cron_logs` table for job status
- Verify uplines exist in database
- Check wallet update permissions in Supabase

### Issue: Rank not updating

- Manually trigger: POST `/admin/recalculate-rank/:userId`
- Rank auto-updates after package purchase
- Rank auto-updates when direct referral buys package

### Issue: Same cron run multiple times

- System checks `process_date` in `cron_logs`
- If job runs multiple times in same day, only first run processes
- Second+ runs return "Already processed today"

## Security Considerations

1. **Cron Authentication**: Use strong `CRON_SECRET`
2. **Admin Endpoints**: Protected by `adminMiddleware`
3. **Referral Chain**: No more than 3 levels payable
4. **Data Validation**: All amounts validated as positive decimals
5. **Transaction Logging**: All referral movements logged for audit

## Future Enhancements

1. **Referral Limits**: Cap maximum referral earnings per user per day
2. **Withdrawal Requests**: Separate withdrawal balance from main
3. **Referral Tiers**: Additional incentives for top referrers
4. **Real-Time Notifications**: WebSocket updates for referral earnings
5. **Referral Leaderboard**: Top referrers dashboard
6. **Suspended Referrals**: Stop bonuses if downline becomes inactive

## Support

For issues or questions about the referral system:

1. Check this guide first
2. Review code comments in `server/utils/referral.ts`
3. Check Supabase logs for database errors
4. Review `cron_logs` table for job execution status
