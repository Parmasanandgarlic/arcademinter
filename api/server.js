const express = require('express');
const { Pool } = require('pg');
const { encryptKey, decryptKey } = require('./kms-service');
const { createApiKeyAuth } = require('./security');
const {
  normalizeNetwork,
  normalizePattern,
  isValidPublicKey,
  isReasonablePrivateKey,
} = require('./validation');
require('dotenv').config();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use('/api/', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PORT = Number(process.env.PORT || 3000);
const requireWorkerAuth = createApiKeyAuth({ envName: 'WORKER_API_KEY' });
const requirePlatformAuth = createApiKeyAuth({ envName: 'PLATFORM_API_KEY' });

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/v1/submit_keypair', requireWorkerAuth, async (req, res) => {
  const { publicKey, privateKey } = req.body || {};
  const network = normalizeNetwork(req.body?.network);

  if (!network) {
    return res.status(400).json({ error: 'network must be either evm or solana.' });
  }
  if (!isValidPublicKey(publicKey, network)) {
    return res.status(400).json({ error: `Invalid ${network} public key.` });
  }
  if (!isReasonablePrivateKey(privateKey)) {
    return res.status(400).json({ error: 'Invalid private key payload.' });
  }

  const pattern = publicKey.slice(-3).toLowerCase();

  try {
    const encryptedPayload = await encryptKey(privateKey);
    await pool.query(
      `INSERT INTO vanity_keys(public_key, encrypted_payload, network, pattern)
       VALUES($1, $2, $3, $4)`,
      [publicKey, encryptedPayload, network, pattern],
    );
    res.status(201).json({ success: true, publicKey, network, pattern });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Keypair already exists.' });
    }
    console.error('Error storing key:', error.message);
    res.status(500).json({ error: 'Failed to store key.' });
  }
});

app.get('/api/v1/request_address', requirePlatformAuth, async (req, res) => {
  const pattern = normalizePattern(req.query.pattern);
  const network = normalizeNetwork(req.query.network);

  if (!pattern || !network) {
    return res.status(400).json({ error: 'Valid pattern and network query parameters are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT public_key
       FROM vanity_keys
       WHERE status = 'available' AND pattern = $1 AND network = $2
       ORDER BY id
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [pattern, network],
    );

    if (result.rows.length === 0) {
      await client.query('COMMIT');
      return res.status(404).json({ error: 'No available address for this pattern and network.' });
    }

    const publicKey = result.rows[0].public_key;
    await client.query(
      `UPDATE vanity_keys
       SET status = 'assigned', assigned_at = NOW()
       WHERE public_key = $1`,
      [publicKey],
    );
    await client.query('COMMIT');
    res.json({ publicKey, network, pattern });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error requesting address:', error.message);
    res.status(500).json({ error: 'Server error.' });
  } finally {
    client.release();
  }
});

app.post('/api/v1/claim_address', requirePlatformAuth, async (req, res) => {
  const { publicKey } = req.body || {};
  if (typeof publicKey !== 'string' || publicKey.length < 3 || publicKey.length > 255) {
    return res.status(400).json({ error: 'A valid publicKey is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT encrypted_payload
       FROM vanity_keys
       WHERE status = 'assigned' AND public_key = $1
       FOR UPDATE`,
      [publicKey],
    );

    if (result.rows.length === 0) {
      await client.query('COMMIT');
      return res.status(404).json({ error: 'Address not found, not assigned, or already claimed.' });
    }

    // The row lock makes key release single-consumer. If decryption fails, the
    // transaction rolls back and the encrypted inventory remains recoverable.
    const privateKey = await decryptKey(result.rows[0].encrypted_payload);
    await client.query('DELETE FROM vanity_keys WHERE public_key = $1', [publicKey]);
    await client.query('COMMIT');
    res.json({ privateKey });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error claiming address:', error.message);
    res.status(500).json({ error: 'Server error.' });
  } finally {
    client.release();
  }
});

app.listen(PORT, () => {
  console.log(`Vanity Factory API listening on port ${PORT}`);
});
