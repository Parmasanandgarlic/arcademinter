const NETWORKS = new Set(['evm', 'solana']);

function normalizeNetwork(value) {
  if (typeof value !== 'string') return null;
  const network = value.trim().toLowerCase();
  return NETWORKS.has(network) ? network : null;
}

function normalizePattern(value) {
  if (typeof value !== 'string') return null;
  const pattern = value.trim().toLowerCase();
  if (!/^[a-z0-9]{1,20}$/.test(pattern)) return null;
  return pattern;
}

function isValidPublicKey(value, network) {
  if (typeof value !== 'string') return false;
  if (network === 'evm') return /^0x[0-9a-fA-F]{40}$/.test(value);
  if (network === 'solana') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
  return false;
}

function isReasonablePrivateKey(value) {
  return typeof value === 'string' && value.length >= 32 && value.length <= 256;
}

module.exports = {
  normalizeNetwork,
  normalizePattern,
  isValidPublicKey,
  isReasonablePrivateKey,
};
