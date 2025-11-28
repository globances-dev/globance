-- ========================================
-- P2P SYSTEM UPGRADE - PROFESSIONAL EXCHANGE
-- ========================================
-- This migration upgrades the P2P system to exchange-level functionality
-- with fiat currencies, payment methods, escrow, and dispute resolution

-- ========================================
-- 1. ADD ESCROW BALANCE TO WALLETS
-- ========================================
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS escrow_balance DECIMAL(20, 8) DEFAULT 0 NOT NULL;

-- Create index for escrow queries
CREATE INDEX IF NOT EXISTS idx_wallets_escrow_balance ON wallets(escrow_balance);

-- ========================================
-- 2. FIAT CURRENCIES TABLE (Admin-controlled price ranges)
-- ========================================
CREATE TABLE IF NOT EXISTS fiat_currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL, -- ETB, NGN, KES, etc.
  name VARCHAR(100) NOT NULL, -- Ethiopian Birr, Nigerian Naira, etc.
  country VARCHAR(100) NOT NULL,
  min_price DECIMAL(20, 8) NOT NULL, -- Minimum allowed USDT price in this fiat
  max_price DECIMAL(20, 8) NOT NULL, -- Maximum allowed USDT price in this fiat
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fiat_currencies_code ON fiat_currencies(code);
CREATE INDEX IF NOT EXISTS idx_fiat_currencies_active ON fiat_currencies(is_active);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS trigger_fiat_currencies_updated_at ON fiat_currencies;
CREATE TRIGGER trigger_fiat_currencies_updated_at
  BEFORE UPDATE ON fiat_currencies FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Insert default fiat currencies
INSERT INTO fiat_currencies (code, name, country, min_price, max_price, is_active)
VALUES
  ('ETB', 'Ethiopian Birr', 'Ethiopia', 170.00, 180.00, true),
  ('NGN', 'Nigerian Naira', 'Nigeria', 1600.00, 1700.00, true),
  ('KES', 'Kenyan Shilling', 'Kenya', 140.00, 150.00, true),
  ('GHS', 'Ghanaian Cedi', 'Ghana', 16.00, 18.00, true),
  ('ZAR', 'South African Rand', 'South Africa', 18.00, 20.00, true)
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- 3. USER PAYMENT METHODS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS user_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fiat_currency_code VARCHAR(10) NOT NULL REFERENCES fiat_currencies(code),
  type VARCHAR(50) NOT NULL, -- 'bank' or 'mobile_money'
  provider_name VARCHAR(100) NOT NULL, -- Bank name or mobile money provider
  account_name VARCHAR(200) NOT NULL, -- Account holder name
  account_number VARCHAR(100) NOT NULL, -- Account number or phone number
  extra_info JSONB DEFAULT '{}', -- Branch, additional details
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON user_payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_fiat ON user_payment_methods(fiat_currency_code);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON user_payment_methods(is_active);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS trigger_payment_methods_updated_at ON user_payment_methods;
CREATE TRIGGER trigger_payment_methods_updated_at
  BEFORE UPDATE ON user_payment_methods FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ========================================
-- 4. UPDATE P2P OFFERS TABLE
-- ========================================
-- Drop existing offers table if it has incompatible structure
-- Then recreate with new schema

DROP TABLE IF EXISTS p2p_offers CASCADE;

CREATE TABLE p2p_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
  total_amount_usdt DECIMAL(20, 8) NOT NULL CHECK (total_amount_usdt > 0),
  remaining_amount_usdt DECIMAL(20, 8) NOT NULL CHECK (remaining_amount_usdt >= 0),
  price_fiat_per_usdt DECIMAL(20, 8) NOT NULL CHECK (price_fiat_per_usdt > 0),
  fiat_currency_code VARCHAR(10) NOT NULL REFERENCES fiat_currencies(code),
  country VARCHAR(100) NOT NULL,
  min_limit_fiat DECIMAL(20, 8) NOT NULL CHECK (min_limit_fiat > 0),
  max_limit_fiat DECIMAL(20, 8) NOT NULL CHECK (max_limit_fiat >= min_limit_fiat),
  payment_method_ids UUID[] NOT NULL DEFAULT '{}', -- Array of user_payment_methods.id
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_offers_user ON p2p_offers(user_id);
CREATE INDEX IF NOT EXISTS idx_offers_side ON p2p_offers(side);
CREATE INDEX IF NOT EXISTS idx_offers_fiat ON p2p_offers(fiat_currency_code);
CREATE INDEX IF NOT EXISTS idx_offers_active ON p2p_offers(is_active);
CREATE INDEX IF NOT EXISTS idx_offers_remaining ON p2p_offers(remaining_amount_usdt);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS trigger_offers_updated_at ON p2p_offers;
CREATE TRIGGER trigger_offers_updated_at
  BEFORE UPDATE ON p2p_offers FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ========================================
-- 5. UPDATE P2P TRADES TABLE (Complete state machine)
-- ========================================
DROP TABLE IF EXISTS p2p_trades CASCADE;

CREATE TABLE p2p_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES p2p_offers(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_usdt DECIMAL(20, 8) NOT NULL CHECK (amount_usdt > 0),
  price_fiat_per_usdt DECIMAL(20, 8) NOT NULL,
  total_fiat DECIMAL(20, 8) NOT NULL CHECK (total_fiat > 0),
  fiat_currency_code VARCHAR(10) NOT NULL REFERENCES fiat_currencies(code),
  buyer_payment_method_id UUID REFERENCES user_payment_methods(id),
  seller_payment_method_id UUID REFERENCES user_payment_methods(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'payment_sent',
    'released',
    'cancelled',
    'expired',
    'disputed',
    'dispute_resolved_buyer',
    'dispute_resolved_seller'
  )),
  escrow_amount_usdt DECIMAL(20, 8) NOT NULL DEFAULT 0,
  payment_deadline TIMESTAMP,
  payment_receipt_url TEXT,
  dispute_reason TEXT,
  dispute_notes JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trades_offer ON p2p_trades(offer_id);
CREATE INDEX IF NOT EXISTS idx_trades_buyer ON p2p_trades(buyer_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller ON p2p_trades(seller_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON p2p_trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_deadline ON p2p_trades(payment_deadline);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS trigger_trades_updated_at ON p2p_trades;
CREATE TRIGGER trigger_trades_updated_at
  BEFORE UPDATE ON p2p_trades FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ========================================
-- 6. P2P CHAT MESSAGES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS p2p_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES p2p_trades(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  attachment_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_trade ON p2p_chat_messages(trade_id);
CREATE INDEX IF NOT EXISTS idx_chat_sender ON p2p_chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON p2p_chat_messages(created_at);

-- ========================================
-- 7. ENABLE ROW LEVEL SECURITY
-- ========================================

-- Fiat currencies (public read, admin write)
ALTER TABLE fiat_currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active fiat currencies" ON fiat_currencies
  FOR SELECT USING (is_active = true);
CREATE POLICY "Only admins can modify fiat currencies" ON fiat_currencies
  FOR ALL USING (false); -- Will be managed via backend with admin auth

-- User payment methods (users can manage their own)
ALTER TABLE user_payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own payment methods" ON user_payment_methods
  FOR SELECT USING (false); -- Backend will handle authorization
CREATE POLICY "Users can manage their own payment methods" ON user_payment_methods
  FOR ALL USING (false); -- Backend will handle authorization

-- P2P offers (public read active, users manage their own)
ALTER TABLE p2p_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active offers" ON p2p_offers
  FOR SELECT USING (is_active = true);
CREATE POLICY "Users can manage their own offers" ON p2p_offers
  FOR ALL USING (false); -- Backend will handle authorization

-- P2P trades (participants only)
ALTER TABLE p2p_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view their trades" ON p2p_trades
  FOR SELECT USING (false); -- Backend will handle authorization
CREATE POLICY "Participants can manage their trades" ON p2p_trades
  FOR ALL USING (false); -- Backend will handle authorization

-- P2P chat (trade participants only)
ALTER TABLE p2p_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trade participants can view chat" ON p2p_chat_messages
  FOR SELECT USING (false); -- Backend will handle authorization
CREATE POLICY "Trade participants can send messages" ON p2p_chat_messages
  FOR INSERT WITH CHECK (false); -- Backend will handle authorization

-- ========================================
-- 8. CREATE HELPER FUNCTIONS
-- ========================================

-- Function to check if user has enough free USDT (not locked in escrow)
CREATE OR REPLACE FUNCTION get_user_free_usdt_balance(p_user_id UUID)
RETURNS DECIMAL(20, 8) AS $$
DECLARE
  v_total_balance DECIMAL(20, 8);
  v_escrow_balance DECIMAL(20, 8);
BEGIN
  SELECT usdt_balance, escrow_balance INTO v_total_balance, v_escrow_balance
  FROM wallets
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(v_total_balance, 0) - COALESCE(v_escrow_balance, 0);
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
-- Summary:
-- - Added escrow_balance to wallets
-- - Created fiat_currencies table with price ranges
-- - Created user_payment_methods table
-- - Recreated p2p_offers with new schema
-- - Recreated p2p_trades with complete state machine
-- - Created p2p_chat_messages table
-- - Enabled RLS on all P2P tables
-- - Created helper functions
