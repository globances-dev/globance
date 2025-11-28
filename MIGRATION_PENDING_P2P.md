# PENDING MIGRATION: Add payment_deadline to trades table

## Issue
The P2P trade expiry cron job is failing because the `payment_deadline` column is missing from the `trades` table in Supabase.

Error log:
```
column trades.payment_deadline does not exist
```

## Required SQL
Execute this in your Supabase SQL editor (https://app.supabase.com):

```sql
-- Add payment_deadline column to trades table
ALTER TABLE trades
ADD COLUMN payment_deadline TIMESTAMP NULL DEFAULT NULL;

-- Verify the column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'trades' AND column_name = 'payment_deadline';
```

## How to Apply
1. Go to Supabase Dashboard → SQL Editor
2. Create a new query
3. Paste the SQL above
4. Execute

## Impact
Once applied:
- P2P trades will have a 30-minute payment window
- Cron job will automatically expire trades after payment deadline passes
- Cron logs will stop reporting the `payment_deadline` column error
- P2P trade expiry system will work cleanly

## Code References
- **Trade Creation**: `server/routes/p2p-trades.ts` - Sets payment_deadline to now + 30 minutes
- **Cron Job**: `server/utils/p2p-cron.ts` - Queries for expired trades via payment_deadline
- **Mining Cron**: `server/routes/mining.ts` - Calls expireOverdueTrades() daily at 21:00 UTC

Status: **WAITING FOR MANUAL SUPABASE SETUP**
