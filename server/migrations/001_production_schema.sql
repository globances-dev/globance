-- ========================================
-- GLOBANCE PRODUCTION DATABASE SCHEMA
-- ========================================
-- This comprehensive migration creates all tables needed for production
-- Run this ONCE on your production Neon PostgreSQL database

-- ========================================
-- 1. USERS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
  ref_code VARCHAR(20) UNIQUE NOT NULL,
  ref_by UUID REFERENCES users(id) ON DELETE SET NULL,
  current_rank VARCHAR(50) DEFAULT 'Bronze' CHECK (current_rank IN ('Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legendary')),
  is_verified BOOLEAN DEFAULT FALSE,
  is_frozen BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_ref_code ON users(ref_code);
CREATE INDEX IF NOT EXISTS idx_users_ref_by ON users(ref_by);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_current_rank ON users(current_rank);

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
-- 3. PACKAGES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS packages (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  min_amount DECIMAL(18, 8) NOT NULL,
  daily_percent DECIMAL(5, 2) NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 270,
  referral_required INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO packages (id, name, min_amount, daily_percent, duration_days, referral_required, description)
VALUES
  ('bronze', 'Bronze', 10.00, 2.5, 270, 0, 'Entry-level mining package'),
  ('silver', 'Silver', 100.00, 2.6, 270, 5, 'Mid-tier mining package'),
  ('gold', 'Gold', 300.00, 2.7, 270, 10, 'Advanced mining package'),
  ('platinum', 'Platinum', 500.00, 2.8, 270, 15, 'Premium mining package'),
  ('diamond', 'Diamond', 700.00, 2.9, 270, 20, 'Elite mining package'),
  ('legendary', 'Legendary', 1000.00, 3.0, 270, 25, 'Ultimate mining package')
ON CONFLICT (id) DO UPDATE SET
  min_amount = EXCLUDED.min_amount,
  daily_percent = EXCLUDED.daily_percent,
  referral_required = EXCLUDED.referral_required;

-- ========================================
-- 4. PURCHASES TABLE (Cloud Mining Packages)
-- ========================================
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id VARCHAR(50) NOT NULL REFERENCES packages(id),
  amount DECIMAL(18, 8) NOT NULL,
  daily_earning DECIMAL(18, 8) GENERATED ALWAYS AS (amount * (
    CASE 
      WHEN package_id = 'bronze' THEN 0.025
      WHEN package_id = 'silver' THEN 0.026
      WHEN package_id = 'gold' THEN 0.027
      WHEN package_id = 'platinum' THEN 0.028
      WHEN package_id = 'diamond' THEN 0.029
      WHEN package_id = 'legendary' THEN 0.030
      ELSE 0
    END
  )) STORED,
  start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP NOT NULL,
  last_reward_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_earned DECIMAL(18, 8) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_end_time ON purchases(end_time);

-- ========================================
-- 5. DEPOSIT ADDRESSES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS deposit_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  network VARCHAR(50) NOT NULL CHECK (network IN ('TRC20', 'BEP20')),
  address VARCHAR(255) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  provider_wallet_id VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deposit_addresses_user ON deposit_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_addresses_network ON deposit_addresses(network);

-- ========================================
-- 6. DEPOSITS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(18, 8) NOT NULL,
  network VARCHAR(50) NOT NULL,
  txid VARCHAR(255),
  provider VARCHAR(100) NOT NULL,
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
-- 7. P2P OFFERS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('buy', 'sell')),
  amount DECIMAL(18, 8) NOT NULL,
  price DECIMAL(18, 8) NOT NULL,
  network VARCHAR(50) NOT NULL CHECK (network IN ('TRC20', 'BEP20')),
  fiat_currency VARCHAR(10) NOT NULL,
  country VARCHAR(100),
  payment_method TEXT,
  min_limit DECIMAL(18, 8),
  max_limit DECIMAL(18, 8),
  margin DECIMAL(5, 2),
  kyc_required BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'paused')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_offers_user ON offers(user_id);
CREATE INDEX IF NOT EXISTS idx_offers_type ON offers(type);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);

-- ========================================
-- 8. P2P TRADES TABLE (with escrow)
-- ========================================
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  amount DECIMAL(18, 8) NOT NULL,
  price DECIMAL(18, 8) NOT NULL,
  total_value DECIMAL(18, 8) NOT NULL,
  payment_method TEXT,
  network VARCHAR(50) NOT NULL,
  escrow_amount DECIMAL(18, 8),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'payment_sent', 'payment_confirmed', 'released', 'disputed', 'cancelled', 'completed')),
  dispute_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trades_buyer ON trades(buyer_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller ON trades(seller_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);

-- ========================================
-- 9. REFERRAL BONUS TRANSACTIONS TABLE
-- ========================================
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

CREATE INDEX IF NOT EXISTS idx_referral_bonus_to_user ON referral_bonus_transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_bonus_from_user ON referral_bonus_transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_bonus_type ON referral_bonus_transactions(type);

-- ========================================
-- 10. EARNINGS TRANSACTIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS earnings_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id VARCHAR(50),
  amount DECIMAL(18, 8) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('daily_mining_income', 'investment', 'deposit', 'referral_bonus', 'withdrawal')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_earnings_user ON earnings_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_earnings_type ON earnings_transactions(type);

-- ========================================
-- 11. CRON LOGS TABLE (for idempotency)
-- ========================================
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_cron_logs_type_date ON cron_logs(process_type, process_date);
CREATE INDEX IF NOT EXISTS idx_cron_logs_date ON cron_logs(process_date);

-- ========================================
-- 12. AUDIT LOGS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- ========================================
-- 13. TRIGGER FUNCTIONS FOR TIMESTAMPS
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to all tables with updated_at
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_wallets_updated_at ON wallets;
CREATE TRIGGER trigger_wallets_updated_at
  BEFORE UPDATE ON wallets FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_purchases_updated_at ON purchases;
CREATE TRIGGER trigger_purchases_updated_at
  BEFORE UPDATE ON purchases FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_deposits_updated_at ON deposits;
CREATE TRIGGER trigger_deposits_updated_at
  BEFORE UPDATE ON deposits FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_trades_updated_at ON trades;
CREATE TRIGGER trigger_trades_updated_at
  BEFORE UPDATE ON trades FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_referral_bonus_updated_at ON referral_bonus_transactions;
CREATE TRIGGER trigger_referral_bonus_updated_at
  BEFORE UPDATE ON referral_bonus_transactions FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_earnings_updated_at ON earnings_transactions;
CREATE TRIGGER trigger_earnings_updated_at
  BEFORE UPDATE ON earnings_transactions FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ========================================
-- 14. ROW LEVEL SECURITY (Optional but recommended)
-- ========================================
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Users can view their own user data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text OR auth.jwt() ->> 'role' = 'admin');

-- Users can view their own wallet
CREATE POLICY "Users can view own wallet" ON wallets
  FOR SELECT USING (auth.uid()::text = user_id::text OR auth.jwt() ->> 'role' = 'admin');

-- Users can view their own purchases
CREATE POLICY "Users can view own purchases" ON purchases
  FOR SELECT USING (auth.uid()::text = user_id::text OR auth.jwt() ->> 'role' = 'admin');

-- Users can view their own deposits
CREATE POLICY "Users can view own deposits" ON deposits
  FOR SELECT USING (auth.uid()::text = user_id::text OR auth.jwt() ->> 'role' = 'admin');

-- Users can view all offers
CREATE POLICY "Users can view all offers" ON offers
  FOR SELECT USING (true);

-- Users can view all trades they're involved in
CREATE POLICY "Users can view own trades" ON trades
  FOR SELECT USING (auth.uid()::text = buyer_id::text OR auth.uid()::text = seller_id::text OR auth.jwt() ->> 'role' = 'admin');

-- ========================================
-- VERIFICATION QUERIES (Run these to confirm all tables exist)
-- ========================================
-- SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
