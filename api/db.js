const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const createTable = async () => {
  const queryText = `
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
  `;
  try {
    await pool.query(queryText);
    console.log('Table "vanity_keys" created successfully.');
  } catch (err) {
    console.error('Error creating table', err.stack);
  } finally {
    await pool.end();
  }
};
createTable();

