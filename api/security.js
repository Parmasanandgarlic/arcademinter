const crypto = require('crypto');

function constantTimeEqual(candidate, configured) {
  if (typeof candidate !== 'string' || typeof configured !== 'string') return false;
  const candidateBuffer = Buffer.from(candidate);
  const configuredBuffer = Buffer.from(configured);
  if (candidateBuffer.length !== configuredBuffer.length) return false;
  return crypto.timingSafeEqual(candidateBuffer, configuredBuffer);
}

function createApiKeyAuth({ envName, headerName = 'x-api-key', minimumLength = 32 }) {
  return (req, res, next) => {
    const configured = process.env[envName];
    if (typeof configured !== 'string' || configured.length < minimumLength) {
      console.error(`${envName} is missing or too short; refusing privileged requests.`);
      return res.status(503).json({ error: 'Service authentication is not configured.' });
    }

    const candidate = req.get(headerName);
    if (!constantTimeEqual(candidate, configured)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
  };
}

function createClaimToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashClaimToken(token) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 256) return null;
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function claimTokenMatches(token, expectedHash) {
  const actualHash = hashClaimToken(token);
  if (!actualHash || typeof expectedHash !== 'string' || !/^[0-9a-f]{64}$/i.test(expectedHash)) {
    return false;
  }
  return constantTimeEqual(actualHash.toLowerCase(), expectedHash.toLowerCase());
}

function getClaimLeaseSeconds(raw = process.env.CLAIM_LEASE_SECONDS) {
  const parsed = Number(raw ?? 600);
  if (!Number.isInteger(parsed)) return 600;
  return Math.min(Math.max(parsed, 60), 3600);
}

module.exports = {
  constantTimeEqual,
  createApiKeyAuth,
  createClaimToken,
  hashClaimToken,
  claimTokenMatches,
  getClaimLeaseSeconds,
};
