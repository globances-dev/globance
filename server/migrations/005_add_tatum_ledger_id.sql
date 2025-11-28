-- ========================================
-- Migration: Add Tatum Ledger Integration
-- ========================================
-- This migration adds support for Tatum custodial ledger system
-- Replaces NOWPayments with Tatum for deposits/withdrawals

-- Add tatum_ledger_id to users table
-- This stores the Tatum virtual account ID for each user
ALTER TABLE users ADD COLUMN IF NOT EXISTS tatum_ledger_id VARCHAR(255);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_tatum_ledger_id ON users(tatum_ledger_id);

-- Add minimum USDT amount configuration
-- This can be used to track min deposit/withdrawal amounts
CREATE TABLE IF NOT EXISTS platform_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default minimum USDT configuration
INSERT INTO platform_config (key, value, description)
VALUES 
  ('min_usdt_deposit', '5', 'Minimum USDT deposit amount'),
  ('min_usdt_withdrawal', '5', 'Minimum USDT withdrawal amount')
ON CONFLICT (key) DO NOTHING;

-- Update deposit_addresses table to support Tatum provider
-- (Already has 'provider' column, just documenting Tatum as valid provider)
COMMENT ON COLUMN deposit_addresses.provider IS 'Payment provider: nowpayments or tatum';

-- Add comment to withdrawals table for Tatum integration
COMMENT ON TABLE withdrawals IS 'Withdrawal requests - now processed automatically via Tatum';
