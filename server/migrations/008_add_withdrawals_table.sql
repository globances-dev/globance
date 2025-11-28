-- ========================================
-- Migration 008: Add Withdrawals Table
-- ========================================
-- This migration adds the withdrawals table for manual withdrawal system
-- (replacing automatic NOWPayments payouts)

CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_usdt DECIMAL(18, 8) NOT NULL,
  fee_usdt DECIMAL(18, 8) NOT NULL DEFAULT 1.0,
  net_amount_usdt DECIMAL(18, 8) NOT NULL,
  address VARCHAR(255) NOT NULL,
  network VARCHAR(50) NOT NULL CHECK (network IN ('TRC20', 'BEP20')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  rejected_reason TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created ON withdrawals(created_at);

-- Add trigger for automatic updated_at timestamp
DROP TRIGGER IF EXISTS trigger_withdrawals_updated_at ON withdrawals;
CREATE TRIGGER trigger_withdrawals_updated_at
  BEFORE UPDATE ON withdrawals FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ========================================
-- Verification Query
-- ========================================
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'withdrawals' ORDER BY ordinal_position;
