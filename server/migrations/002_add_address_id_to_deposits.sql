-- Add address_id column to deposits table
-- This allows us to link deposits to specific deposit addresses

ALTER TABLE deposits 
ADD COLUMN IF NOT EXISTS address_id UUID REFERENCES deposit_addresses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deposits_address ON deposits(address_id);

-- Add unique index on address to prevent duplicate addresses
CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_addresses_unique ON deposit_addresses(user_id, network, address);
