-- Add approved payment providers table for admin-managed payment provider list
CREATE TABLE IF NOT EXISTS approved_payment_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiat_currency_code VARCHAR(10) NOT NULL REFERENCES fiat_currencies(code) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('bank', 'mobile_money', 'other')),
  provider_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fiat_currency_code, type, provider_name)
);

-- Create index for faster queries
CREATE INDEX idx_approved_payment_providers_currency ON approved_payment_providers(fiat_currency_code);
CREATE INDEX idx_approved_payment_providers_active ON approved_payment_providers(is_active);

-- Insert some example providers for common currencies (Ethiopia, Kenya, Nigeria)
INSERT INTO approved_payment_providers (fiat_currency_code, type, provider_name, is_active) VALUES
  ('ETB', 'bank', 'Commercial Bank of Ethiopia', true),
  ('ETB', 'bank', 'Awash Bank', true),
  ('ETB', 'bank', 'Dashen Bank', true),
  ('ETB', 'bank', 'Bank of Abyssinia', true),
  ('ETB', 'mobile_money', 'CBE Birr', true),
  ('ETB', 'mobile_money', 'TeleBirr', true),
  ('ETB', 'mobile_money', 'M-Pesa Ethiopia', true)
ON CONFLICT (fiat_currency_code, type, provider_name) DO NOTHING;
