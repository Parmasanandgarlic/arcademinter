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

module.exports = { constantTimeEqual, createApiKeyAuth };
