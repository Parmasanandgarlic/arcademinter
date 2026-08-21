-- Create the vanity_keys table
CREATE TABLE IF NOT EXISTS vanity_keys (
  id SERIAL PRIMARY KEY,
  public_key VARCHAR(255) UNIQUE NOT NULL,
  encrypted_payload JSONB NOT NULL,
  network VARCHAR(10) NOT NULL,
  pattern VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'available',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  assigned_at TIMESTAMP WITH TIME ZONE,
  claim_token_hash VARCHAR(64),
  lease_expires_at TIMESTAMP WITH TIME ZONE
);

-- Forward-compatible additions for databases created before claim leases existed.
ALTER TABLE vanity_keys ADD COLUMN IF NOT EXISTS claim_token_hash VARCHAR(64);
ALTER TABLE vanity_keys ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for allocation and lease cleanup.
CREATE INDEX IF NOT EXISTS idx_vanity_keys_status_pattern_network
  ON vanity_keys(status, pattern, network);
CREATE INDEX IF NOT EXISTS idx_vanity_keys_public_key ON vanity_keys(public_key);
CREATE INDEX IF NOT EXISTS idx_vanity_keys_pattern ON vanity_keys(pattern);
CREATE INDEX IF NOT EXISTS idx_vanity_keys_lease_expiry
  ON vanity_keys(lease_expires_at)
  WHERE status = 'assigned';

-- Log successful initialization
DO $$
BEGIN
  RAISE NOTICE 'Vanity keys table, claim-lease columns, and indexes initialized successfully';
END $$;
