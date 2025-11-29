import { supabase } from "./supabase";

const WITHDRAWALS_TABLE_SQL = `
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
`;

const WITHDRAWALS_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created ON withdrawals(created_at);
`;

const UPDATE_UPDATED_AT_FUNCTION_SQL = `
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

const WITHDRAWALS_TRIGGER_SQL = `
DROP TRIGGER IF EXISTS trigger_withdrawals_updated_at ON withdrawals;
CREATE TRIGGER trigger_withdrawals_updated_at
  BEFORE UPDATE ON withdrawals FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
`;

export async function initializeDatabaseTables() {
  try {
    const pool = getPostgresPool();
    
    // Create withdrawals table
    console.log('[DB-Init] Creating withdrawals table...');
    await pool.query(WITHDRAWALS_TABLE_SQL);
    console.log('[DB-Init] ✓ Withdrawals table ready');
    
    // Create indexes
    console.log('[DB-Init] Creating indexes...');
    await pool.query(WITHDRAWALS_INDEXES_SQL);
    console.log('[DB-Init] ✓ Indexes created');
    
    // Create update_updated_at function
    console.log('[DB-Init] Creating update_updated_at function...');
    await pool.query(UPDATE_UPDATED_AT_FUNCTION_SQL);
    console.log('[DB-Init] ✓ Function created');
    
    // Create trigger
    console.log('[DB-Init] Creating trigger...');
    await pool.query(WITHDRAWALS_TRIGGER_SQL);
    console.log('[DB-Init] ✓ Trigger created');
    
    console.log('[DB-Init] ✓ All database tables initialized successfully');
  } catch (error: any) {
    console.error('[DB-Init] Error initializing database:', error.message);
    throw error;
  }
}
