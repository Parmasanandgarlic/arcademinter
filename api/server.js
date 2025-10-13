const express = require('express');
const { Pool } = require('pg');
const { encryptKey, decryptKey } = require('./kms-service');
require('dotenv').config();
const app = express();
app.use(express.json());
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PORT = process.env.PORT || 3000;
const WORKER_API_KEY = process.env.WORKER_API_KEY;
const requireWorkerAuth = (req, res, next) => {
  const apiKey = req.get('x-api-key');
  if (apiKey && apiKey === WORKER_API_KEY) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
const requirePlatformAuth = (req, res, next) => {
  console.log("Platform auth placeholder: allowing request.");
  next();
};
app.post('/api/v1/submit_keypair', requireWorkerAuth, async (req, res) => {
  const { publicKey, privateKey, network } = req.body;
  
  if (!publicKey || !privateKey || !network) {
    return res.status(400).json({ error: 'Missing required fields: publicKey, privateKey, network' });
  }
  if (typeof publicKey !== 'string' || publicKey.length < 3) {
    return res.status(400).json({ error: 'Invalid publicKey format' });
  }
  
  const pattern = publicKey.slice(-3).toLowerCase();
  try {
    const encryptedPayload = await encryptKey(privateKey);
    const query = `
      INSERT INTO vanity_keys(public_key, encrypted_payload, network, pattern)
      VALUES($1, $2, $3, $4) RETURNING id;
    `;
    await pool.query(query, [publicKey, encryptedPayload, network, pattern]);
    console.log(`Successfully stored key for pattern: ${pattern}`);
    res.status(201).json({ success: true, publicKey });
  } catch (error) {
    console.error("Error storing key:", error.message);
    res.status(500).json({ error: 'Failed to store key' });
  }
});
app.get('/api/v1/request_address', requirePlatformAuth, async (req, res) => {
    const { pattern } = req.query;
    
    if (!pattern || typeof pattern !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid pattern query parameter' });
    }
    
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const findQuery = `
                SELECT public_key FROM vanity_keys
                WHERE status = 'available' AND pattern = $1
                LIMIT 1 FOR UPDATE SKIP LOCKED;
            `;
            const result = await client.query(findQuery, [pattern.toLowerCase()]);
            if (result.rows.length === 0) {
                await client.query('COMMIT');
                return res.status(404).json({ error: 'No available address for this pattern.' });
            }
            const publicKey = result.rows[0].public_key;
            const updateQuery = `
                UPDATE vanity_keys SET status = 'assigned', assigned_at = NOW()
                WHERE public_key = $1;
            `;
            await client.query(updateQuery, [publicKey]);
            await client.query('COMMIT');
            res.json({ publicKey });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error requesting address:", error.message);
        res.status(500).json({ error: 'Server error' });
    }
});
app.post('/api/v1/claim_address', requirePlatformAuth, async (req, res) => {
    const { publicKey } = req.body;
    
    if (!publicKey || typeof publicKey !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid publicKey in request body' });
    }
    
    try {
        const query = `
            SELECT encrypted_payload FROM vanity_keys
            WHERE status = 'assigned' AND public_key = $1;
        `;
        const result = await pool.query(query, [publicKey]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Address not found, not assigned, or already claimed.' });
        }
        const encryptedPayload = result.rows[0].encrypted_payload;
        const privateKey = await decryptKey(encryptedPayload);
        const deleteQuery = `DELETE FROM vanity_keys WHERE public_key = $1;`;
        await pool.query(deleteQuery, [publicKey]);
        console.log(`Key ${publicKey} claimed and purged.`);
        res.json({ privateKey });
    } catch (error) {
        console.error("Error claiming address:", error.message);
        res.status(500).json({ error: 'Server error' });
    }
});
app.listen(PORT, () => {
  console.log(`Vanity Factory API listening on port ${PORT}`);
});


