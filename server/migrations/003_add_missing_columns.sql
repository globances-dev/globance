-- ========================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ========================================
-- This migration safely adds missing columns without altering existing structure

-- ========================================
-- USERS TABLE - Add missing columns
-- ========================================
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS current_rank VARCHAR(50) DEFAULT 'Bronze';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Copy username to full_name if full_name is empty
UPDATE users SET full_name = username WHERE full_name IS NULL AND username IS NOT NULL;

-- ========================================
-- WALLETS TABLE - Add missing columns
-- ========================================
DO $$ BEGIN
  ALTER TABLE wallets ADD COLUMN IF NOT EXISTS escrow_balance DECIMAL(18, 8) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE wallets ADD COLUMN IF NOT EXISTS total_earned DECIMAL(18, 8) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE wallets ADD COLUMN IF NOT EXISTS total_referral_earned DECIMAL(18, 8) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE wallets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ========================================
-- PACKAGES TABLE - Add missing columns  
-- ========================================
DO $$ BEGIN
  ALTER TABLE packages ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 270;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE packages ADD COLUMN IF NOT EXISTS referral_required INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE packages ADD COLUMN IF NOT EXISTS description TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE packages ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ========================================
-- PURCHASES TABLE - Add missing columns
-- ========================================
DO $$ BEGIN
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS daily_earning DECIMAL(18, 8);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS last_reward_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS days_remaining INTEGER DEFAULT 270;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Set end_date for existing purchases (270 days from creation)
UPDATE purchases 
SET end_date = created_at + INTERVAL '270 days',
    start_date = created_at
WHERE end_date IS NULL;

-- Calculate daily_earning for existing purchases
UPDATE purchases p
SET daily_earning = p.amount * (pkg.daily_percentage / 100)
FROM packages pkg
WHERE p.package_id = pkg.id AND p.daily_earning IS NULL;

-- ========================================
-- DEPOSITS TABLE - Add missing columns
-- ========================================
DO $$ BEGIN
  ALTER TABLE deposits ADD COLUMN IF NOT EXISTS address_id UUID;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE deposits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ========================================
-- WITHDRAWALS TABLE - Add missing columns
-- ========================================
DO $$ BEGIN
  ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS admin_notes TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ========================================
-- SETTINGS TABLE - Ensure exists
-- ========================================
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  key VARCHAR(100) NOT NULL,
  value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category, key)
);

INSERT INTO settings (category, key, value)
VALUES 
  ('support', 'telegram_link', 'https://t.me/globancesupport'),
  ('support', 'whatsapp_link', 'https://wa.me/1234567890')
ON CONFLICT (category, key) DO NOTHING;

-- ========================================
-- Insert default packages if empty
-- ========================================
INSERT INTO packages (name, min_investment, daily_percentage, duration_days, referral_required, description, is_active)
SELECT 'Bronze', 10.00, 2.5, 270, 0, 'Entry-level mining package', true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE name = 'Bronze');

INSERT INTO packages (name, min_investment, daily_percentage, duration_days, referral_required, description, is_active)
SELECT 'Silver', 100.00, 2.6, 270, 5, 'Mid-tier mining package', true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE name = 'Silver');

INSERT INTO packages (name, min_investment, daily_percentage, duration_days, referral_required, description, is_active)
SELECT 'Gold', 300.00, 2.7, 270, 10, 'Advanced mining package', true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE name = 'Gold');

INSERT INTO packages (name, min_investment, daily_percentage, duration_days, referral_required, description, is_active)
SELECT 'Platinum', 500.00, 2.8, 270, 15, 'Premium mining package', true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE name = 'Platinum');

INSERT INTO packages (name, min_investment, daily_percentage, duration_days, referral_required, description, is_active)
SELECT 'Diamond', 700.00, 2.9, 270, 20, 'Elite mining package', true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE name = 'Diamond');

INSERT INTO packages (name, min_investment, daily_percentage, duration_days, referral_required, description, is_active)
SELECT 'Legendary', 1000.00, 3.0, 270, 25, 'Ultimate mining package', true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE name = 'Legendary');

-- ========================================
-- Ensure other important tables exist
-- ========================================
CREATE TABLE IF NOT EXISTS cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_type VARCHAR(50) NOT NULL,
  process_date DATE NOT NULL,
  purchases_processed INTEGER DEFAULT 0,
  total_distributed DECIMAL(18, 8) DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  failed_purchases TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(process_type, process_date)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID,
  user_id UUID,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  amount DECIMAL(18, 8) NOT NULL,
  source_id UUID,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- Create indexes for new columns
-- ========================================
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_current_rank ON users(current_rank);
CREATE INDEX IF NOT EXISTS idx_purchases_end_date ON purchases(end_date);
CREATE INDEX IF NOT EXISTS idx_cron_logs_type_date ON cron_logs(process_type, process_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- ========================================
-- VERIFICATION
-- ========================================
SELECT 'Migration 003 completed successfully!' as status;
