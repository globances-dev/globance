-- ========================================
-- GLOBANCE - NEON POSTGRESQL PRODUCTION SCHEMA
-- ========================================
-- Complete schema for Neon PostgreSQL database
-- This migration creates all tables needed for production
-- Run: psql "$DATABASE_URL" -f server/migrations/002_replit_production_schema.sql

-- ========================================
-- 1. USERS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
  referral_code VARCHAR(20) UNIQUE NOT NULL,
  referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
  current_rank VARCHAR(50) DEFAULT 'Bronze' CHECK (current_rank IN ('Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legendary')),
  is_verified BOOLEAN DEFAULT FALSE,
  is_frozen BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ========================================
-- 2. WALLETS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usdt_balance DECIMAL(18, 8) DEFAULT 0,
  escrow_balance DECIMAL(18, 8) DEFAULT 0,
  total_earned DECIMAL(18, 8) DEFAULT 0,
  total_referral_earned DECIMAL(18, 8) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);

-- ========================================
-- 3. PACKAGES TABLE (Mining Packages)
-- ========================================
CREATE TABLE IF NOT EXISTS packages (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  min_amount DECIMAL(18, 8) NOT NULL,
  daily_percent DECIMAL(5, 2) NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 270,
  referral_required INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default packages
INSERT INTO packages (id, name, min_amount, daily_percent, duration_days, referral_required, description)
VALUES
  ('bronze', 'Bronze', 10.00, 2.5, 270, 0, 'Entry-level mining package with 2.5% daily returns'),
  ('silver', 'Silver', 100.00, 2.6, 270, 5, 'Mid-tier mining package with 2.6% daily returns'),
  ('gold', 'Gold', 300.00, 2.7, 270, 10, 'Advanced mining package with 2.7% daily returns'),
  ('platinum', 'Platinum', 500.00, 2.8, 270, 15, 'Premium mining package with 2.8% daily returns'),
  ('diamond', 'Diamond', 700.00, 2.9, 270, 20, 'Elite mining package with 2.9% daily returns'),
  ('legendary', 'Legendary', 1000.00, 3.0, 270, 25, 'Ultimate mining package with 3.0% daily returns')
ON CONFLICT (id) DO UPDATE SET
  min_amount = EXCLUDED.min_amount,
  daily_percent = EXCLUDED.daily_percent,
  description = EXCLUDED.description;

-- ========================================
-- 4. PURCHASES TABLE (Active Mining Packages)
-- ========================================
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id VARCHAR(50) NOT NULL REFERENCES packages(id),
  amount DECIMAL(18, 8) NOT NULL,
  daily_earning DECIMAL(18, 8) NOT NULL,
  start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP NOT NULL,
  last_reward_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_earned DECIMAL(18, 8) DEFAULT 0,
  days_remaining INTEGER DEFAULT 270,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_end_date ON purchases(end_date);

-- ========================================
-- 5. DEPOSIT ADDRESSES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS deposit_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  network VARCHAR(50) NOT NULL CHECK (network IN ('TRC20', 'BEP20')),
  address VARCHAR(255) NOT NULL,
  provider VARCHAR(100) NOT NULL DEFAULT 'nowpayments',
  provider_wallet_id VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deposit_addresses_user ON deposit_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_addresses_network ON deposit_addresses(network);
CREATE INDEX IF NOT EXISTS idx_deposit_addresses_address ON deposit_addresses(address);

-- ========================================
-- 6. DEPOSITS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address_id UUID REFERENCES deposit_addresses(id),
  amount DECIMAL(18, 8) NOT NULL,
  network VARCHAR(50) NOT NULL,
  txid VARCHAR(255),
  provider VARCHAR(100) NOT NULL DEFAULT 'nowpayments',
  provider_payment_id VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  confirmation_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_provider_id ON deposits(provider_payment_id);

-- ========================================
-- 7. WITHDRAWALS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_usdt DECIMAL(18, 8) NOT NULL,
  fee_usdt DECIMAL(18, 8) DEFAULT 1.0,
  net_amount_usdt DECIMAL(18, 8) NOT NULL,
  wallet_address VARCHAR(255) NOT NULL,
  network VARCHAR(50) NOT NULL CHECK (network IN ('TRC20', 'BEP20')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'failed')),
  txid VARCHAR(255),
  admin_notes TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- ========================================
-- 8. EARNINGS TRANSACTIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS earnings_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purchase_id UUID REFERENCES purchases(id),
  amount DECIMAL(18, 8) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('daily_mining', 'referral_bonus', 'deposit', 'withdrawal', 'package_purchase')),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_earnings_user ON earnings_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_earnings_type ON earnings_transactions(type);
CREATE INDEX IF NOT EXISTS idx_earnings_created ON earnings_transactions(created_at);

-- ========================================
-- 9. MINING EARNINGS TABLE (Daily Payouts)
-- ========================================
CREATE TABLE IF NOT EXISTS mining_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  amount DECIMAL(18, 8) NOT NULL,
  payout_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(purchase_id, payout_date)
);

CREATE INDEX IF NOT EXISTS idx_mining_earnings_user ON mining_earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_mining_earnings_date ON mining_earnings(payout_date);

-- ========================================
-- 10. REFERRAL BONUS TRANSACTIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS referral_bonus_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(18, 8) NOT NULL,
  level INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
  type VARCHAR(50) NOT NULL CHECK (type IN ('purchase_bonus', 'daily_bonus')),
  source_purchase_id UUID REFERENCES purchases(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_referral_bonus_to_user ON referral_bonus_transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_bonus_from_user ON referral_bonus_transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_bonus_type ON referral_bonus_transactions(type);

-- ========================================
-- 11. REFERRALS TABLE (Referral Tracking)
-- ========================================
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(referrer_id, referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);

-- ========================================
-- 12. PASSWORD RESET TOKENS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

-- ========================================
-- 13. SETTINGS TABLE
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

-- Insert default settings
INSERT INTO settings (category, key, value)
VALUES 
  ('support', 'telegram_link', 'https://t.me/globancesupport'),
  ('support', 'whatsapp_link', 'https://wa.me/1234567890')
ON CONFLICT (category, key) DO UPDATE SET value = EXCLUDED.value;

-- ========================================
-- 14. CRON LOGS TABLE
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

CREATE INDEX IF NOT EXISTS idx_cron_logs_type_date ON cron_logs(process_type, process_date);

-- ========================================
-- 15. AUDIT LOGS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- ========================================
-- 16. PLATFORM EARNINGS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS platform_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('withdrawal_fee', 'trade_fee', 'other')),
  amount DECIMAL(18, 8) NOT NULL,
  source_id UUID,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_earnings_type ON platform_earnings(type);

-- ========================================
-- 17. P2P OFFERS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS p2p_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('buy', 'sell')),
  amount DECIMAL(18, 8) NOT NULL,
  min_limit DECIMAL(18, 8) NOT NULL,
  max_limit DECIMAL(18, 8) NOT NULL,
  price_per_usdt DECIMAL(18, 4) NOT NULL,
  fiat_currency VARCHAR(10) NOT NULL,
  payment_methods JSONB NOT NULL DEFAULT '[]',
  terms TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  completed_trades INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_p2p_offers_user ON p2p_offers(user_id);
CREATE INDEX IF NOT EXISTS idx_p2p_offers_type ON p2p_offers(type);
CREATE INDEX IF NOT EXISTS idx_p2p_offers_active ON p2p_offers(is_active);

-- ========================================
-- 18. P2P TRADES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS p2p_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES p2p_offers(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  amount_usdt DECIMAL(18, 8) NOT NULL,
  amount_fiat DECIMAL(18, 4) NOT NULL,
  price_per_usdt DECIMAL(18, 4) NOT NULL,
  fiat_currency VARCHAR(10) NOT NULL,
  payment_method VARCHAR(100),
  escrow_amount DECIMAL(18, 8),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'payment_sent', 'payment_confirmed', 'completed', 'disputed', 'cancelled', 'expired')),
  payment_deadline TIMESTAMP,
  dispute_reason TEXT,
  dispute_resolved_by UUID REFERENCES users(id),
  dispute_resolution TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_p2p_trades_buyer ON p2p_trades(buyer_id);
CREATE INDEX IF NOT EXISTS idx_p2p_trades_seller ON p2p_trades(seller_id);
CREATE INDEX IF NOT EXISTS idx_p2p_trades_status ON p2p_trades(status);

-- ========================================
-- 19. USER PAYMENT METHODS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS user_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID,
  fiat_currency VARCHAR(10) NOT NULL,
  method_type VARCHAR(100) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(255) NOT NULL,
  bank_name VARCHAR(255),
  additional_info JSONB,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_payment_methods_user ON user_payment_methods(user_id);

-- ========================================
-- 20. FIAT CURRENCIES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS fiat_currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(10),
  min_price DECIMAL(18, 4),
  max_price DECIMAL(18, 4),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default fiat currencies
INSERT INTO fiat_currencies (code, name, symbol, min_price, max_price, is_active)
VALUES
  ('ETB', 'Ethiopian Birr', 'Br', 50.00, 200.00, true),
  ('USD', 'US Dollar', '$', 0.95, 1.05, true),
  ('EUR', 'Euro', '€', 0.85, 0.95, true),
  ('GBP', 'British Pound', '£', 0.75, 0.85, true),
  ('NGN', 'Nigerian Naira', '₦', 1400.00, 1800.00, true)
ON CONFLICT (code) DO UPDATE SET
  min_price = EXCLUDED.min_price,
  max_price = EXCLUDED.max_price;

-- ========================================
-- 21. APPROVED PAYMENT PROVIDERS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS approved_payment_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiat_currency VARCHAR(10) NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('bank', 'mobile_money', 'wallet', 'other')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fiat_currency, name)
);

-- Insert default payment providers for Ethiopia
INSERT INTO approved_payment_providers (fiat_currency, name, type, is_active)
VALUES
  ('ETB', 'Commercial Bank of Ethiopia (CBE)', 'bank', true),
  ('ETB', 'Awash Bank', 'bank', true),
  ('ETB', 'Dashen Bank', 'bank', true),
  ('ETB', 'TeleBirr', 'mobile_money', true),
  ('ETB', 'M-Pesa', 'mobile_money', true)
ON CONFLICT (fiat_currency, name) DO NOTHING;

-- ========================================
-- TRIGGER FUNCTION FOR UPDATED_AT
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND column_name = 'updated_at'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_%s_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trigger_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
  END LOOP;
END $$;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';
