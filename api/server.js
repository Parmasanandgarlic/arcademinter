const express = require('express');
const { Pool } = require('pg');
const { encryptKey, decryptKey } = require('./kms-service');
const {
  createApiKeyAuth,
  createClaimToken,
  hashClaimToken,
  claimTokenMatches,
  getClaimLeaseSeconds,
} = require('./security');
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

    // Expired assignments are safe to return to inventory because the private
    // key never left the encrypted store unless claim_address completed.
    await client.query(
      `UPDATE vanity_keys
       SET status = 'available', assigned_at = NULL, claim_token_hash = NULL, lease_expires_at = NULL
       WHERE status = 'assigned' AND lease_expires_at IS NOT NULL AND lease_expires_at <= NOW()`,
    );

    const result = await client.query(
      `SELECT id, public_key
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

    const claimToken = createClaimToken();
    const claimTokenHash = hashClaimToken(claimToken);
    const leaseSeconds = getClaimLeaseSeconds();
    const leaseExpiresAt = new Date(Date.now() + leaseSeconds * 1000);
    const { id, public_key: publicKey } = result.rows[0];

    await client.query(
      `UPDATE vanity_keys
       SET status = 'assigned', assigned_at = NOW(), claim_token_hash = $1, lease_expires_at = $2
       WHERE id = $3`,
      [claimTokenHash, leaseExpiresAt.toISOString(), id],
    );
    await client.query('COMMIT');

    res.json({
      publicKey,
      network,
      pattern,
      claimToken,
      leaseExpiresAt: leaseExpiresAt.toISOString(),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error requesting address:', error.message);
    res.status(500).json({ error: 'Server error.' });
  } finally {
    client.release();
  }
});

app.post('/api/v1/claim_address', requirePlatformAuth, async (req, res) => {
  const { publicKey, claimToken } = req.body || {};
  if (typeof publicKey !== 'string' || publicKey.length < 3 || publicKey.length > 255) {
    return res.status(400).json({ error: 'A valid publicKey is required.' });
  }
  if (!hashClaimToken(claimToken)) {
    return res.status(400).json({ error: 'A valid claimToken is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT encrypted_payload, claim_token_hash, lease_expires_at
       FROM vanity_keys
       WHERE status = 'assigned' AND public_key = $1
       FOR UPDATE`,
      [publicKey],
    );

    const row = result.rows[0];
    const leaseIsLive = row?.lease_expires_at && new Date(row.lease_expires_at).getTime() > Date.now();
    if (!row || !leaseIsLive || !claimTokenMatches(claimToken, row.claim_token_hash)) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Address claim is unavailable or expired.' });
    }

    // The row lock and one-time lease token make key release single-consumer and
    // bind release to the allocation response that created this assignment.
    // If decryption fails, the transaction rolls back and encrypted inventory remains.
    const privateKey = await decryptKey(row.encrypted_payload);
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
