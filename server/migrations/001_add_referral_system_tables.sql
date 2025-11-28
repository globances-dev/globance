-- Migration: Add Referral System Tables and Fields
-- This migration adds support for the complete referral rewards system

-- 1. Add current_rank field to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_rank VARCHAR(50) DEFAULT 'Bronze';

-- 2. Create referral_bonus_transactions table
CREATE TABLE IF NOT EXISTS referral_bonus_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(18, 8) NOT NULL,
  level INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
  type VARCHAR(50) NOT NULL CHECK (type IN ('one_time_purchase', 'daily_referral_income')),
  package_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for referral_bonus_transactions
CREATE INDEX IF NOT EXISTS idx_referral_bonus_to_user ON referral_bonus_transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_bonus_from_user ON referral_bonus_transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_bonus_type ON referral_bonus_transactions(type);
CREATE INDEX IF NOT EXISTS idx_referral_bonus_date ON referral_bonus_transactions(created_at);

-- 3. Create earnings_transactions table
CREATE TABLE IF NOT EXISTS earnings_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id VARCHAR(50) NOT NULL,
  amount DECIMAL(18, 8) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('daily_mining_income', 'investment')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for earnings_transactions
CREATE INDEX IF NOT EXISTS idx_earnings_user ON earnings_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_earnings_type ON earnings_transactions(type);
CREATE INDEX IF NOT EXISTS idx_earnings_date ON earnings_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_earnings_package ON earnings_transactions(package_id);

-- 4. Create cron_logs table for idempotency tracking
CREATE TABLE IF NOT EXISTS cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_type VARCHAR(50) NOT NULL,
  process_date DATE NOT NULL,
  purchases_processed INTEGER DEFAULT 0,
  total_distributed DECIMAL(18, 8) DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  failed_purchases TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for cron_logs
CREATE INDEX IF NOT EXISTS idx_cron_logs_date ON cron_logs(process_date);
CREATE INDEX IF NOT EXISTS idx_cron_logs_type_date ON cron_logs(process_type, process_date);

-- 5. Update packages table if needed (ensure these columns exist)
-- If your packages table uses different column names, map accordingly:
-- - min_invest -> minimum investment amount (default: package specific)
-- - daily_percent -> daily interest rate as percentage (default: package specific)
-- - duration_days -> days per package (default: 270)
-- - referral_required -> required referrals for eligibility (default: 0 for bronze)

ALTER TABLE packages ADD COLUMN IF NOT EXISTS daily_percent DECIMAL(5, 2);
ALTER TABLE packages ADD COLUMN IF NOT EXISTS referral_required INTEGER DEFAULT 0;

-- 6. Update purchases table if needed
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS total_earned DECIMAL(18, 8) DEFAULT 0;

-- Ensure referral_bonus_transactions table has triggers for updated_at
CREATE OR REPLACE FUNCTION update_referral_bonus_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_referral_bonus_timestamp ON referral_bonus_transactions;
CREATE TRIGGER trigger_update_referral_bonus_timestamp
  BEFORE UPDATE ON referral_bonus_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_referral_bonus_timestamp();

-- Ensure earnings_transactions table has triggers for updated_at
CREATE OR REPLACE FUNCTION update_earnings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_earnings_timestamp ON earnings_transactions;
CREATE TRIGGER trigger_update_earnings_timestamp
  BEFORE UPDATE ON earnings_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_earnings_timestamp();

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON referral_bonus_transactions TO postgres;
-- GRANT ALL PRIVILEGES ON earnings_transactions TO postgres;
-- GRANT ALL PRIVILEGES ON cron_logs TO postgres;
