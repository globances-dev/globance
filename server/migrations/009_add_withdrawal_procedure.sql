-- ========================================
-- Migration 009: Add Withdrawal Stored Procedure
-- ========================================
-- Creates a stored procedure to bypass Supabase schema cache issues with withdrawals

CREATE OR REPLACE FUNCTION create_withdrawal(
  p_user_id UUID,
  p_amount_usdt DECIMAL,
  p_fee_usdt DECIMAL,
  p_net_amount_usdt DECIMAL,
  p_address VARCHAR,
  p_network VARCHAR
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  amount_usdt DECIMAL,
  fee_usdt DECIMAL,
  net_amount_usdt DECIMAL,
  address VARCHAR,
  network VARCHAR,
  status VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO withdrawals (user_id, amount_usdt, fee_usdt, net_amount_usdt, address, network, status, created_at, updated_at)
  VALUES (p_user_id, p_amount_usdt, p_fee_usdt, p_net_amount_usdt, p_address, p_network, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  RETURNING withdrawals.id, withdrawals.user_id, withdrawals.amount_usdt, withdrawals.fee_usdt, withdrawals.net_amount_usdt, 
            withdrawals.address, withdrawals.network, withdrawals.status, withdrawals.created_at, withdrawals.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
