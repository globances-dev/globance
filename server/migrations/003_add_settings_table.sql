-- ========================================
-- SETTINGS TABLE FOR SITE-WIDE CONFIGURATION
-- ========================================
-- This table stores site-wide configuration values that can be managed by admins
-- such as social media links, contact information, etc.

CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS trigger_settings_updated_at ON settings;
CREATE TRIGGER trigger_settings_updated_at
  BEFORE UPDATE ON settings FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Insert default settings for Customer Support
INSERT INTO settings (key, value, description, category)
VALUES
  ('telegram_support_link', '', 'Telegram support contact link', 'customer_support'),
  ('whatsapp_support_link', '', 'WhatsApp support contact link', 'customer_support')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings
CREATE POLICY "Anyone can read settings" ON settings
  FOR SELECT USING (true);

-- Only admins can modify settings
CREATE POLICY "Only admins can modify settings" ON settings
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
