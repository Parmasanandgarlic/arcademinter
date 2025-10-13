-- Create the vanity_keys table
CREATE TABLE IF NOT EXISTS vanity_keys (
  id SERIAL PRIMARY KEY,
  public_key VARCHAR(255) UNIQUE NOT NULL,
  encrypted_payload JSONB NOT NULL,
  network VARCHAR(10) NOT NULL,
  pattern VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'available',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  assigned_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_vanity_keys_status_pattern ON vanity_keys(status, pattern);
CREATE INDEX IF NOT EXISTS idx_vanity_keys_public_key ON vanity_keys(public_key);
CREATE INDEX IF NOT EXISTS idx_vanity_keys_pattern ON vanity_keys(pattern);

-- Log successful initialization
DO $$
BEGIN
  RAISE NOTICE 'Vanity keys table and indexes created successfully';
END $$;

