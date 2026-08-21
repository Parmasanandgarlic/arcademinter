const test = require('node:test');
const assert = require('node:assert/strict');
const {
  constantTimeEqual,
  createClaimToken,
  hashClaimToken,
  claimTokenMatches,
  getClaimLeaseSeconds,
} = require('../security');
const {
  normalizeNetwork,
  normalizePattern,
  isValidPublicKey,
  isReasonablePrivateKey,
} = require('../validation');

test('constantTimeEqual accepts equal secrets and rejects mismatches', () => {
  assert.equal(constantTimeEqual('a'.repeat(32), 'a'.repeat(32)), true);
  assert.equal(constantTimeEqual('a'.repeat(32), 'b'.repeat(32)), false);
  assert.equal(constantTimeEqual('short', 'a'.repeat(32)), false);
});

test('claim tokens are random, hashable, and verified without plaintext storage', () => {
  const first = createClaimToken();
  const second = createClaimToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 32);

  const firstHash = hashClaimToken(first);
  assert.match(firstHash, /^[0-9a-f]{64}$/);
  assert.notEqual(firstHash, first);
  assert.equal(claimTokenMatches(first, firstHash), true);
  assert.equal(claimTokenMatches(second, firstHash), false);
  assert.equal(hashClaimToken('short'), null);
});

test('claim lease duration is bounded to a safe operational window', () => {
  assert.equal(getClaimLeaseSeconds(undefined), 600);
  assert.equal(getClaimLeaseSeconds('120'), 120);
  assert.equal(getClaimLeaseSeconds('1'), 60);
  assert.equal(getClaimLeaseSeconds('99999'), 3600);
  assert.equal(getClaimLeaseSeconds('not-a-number'), 600);
});

test('network and pattern normalization are strict', () => {
  assert.equal(normalizeNetwork(' EVM '), 'evm');
  assert.equal(normalizeNetwork('solana'), 'solana');
  assert.equal(normalizeNetwork('bitcoin'), null);
  assert.equal(normalizePattern(' Ab3 '), 'ab3');
  assert.equal(normalizePattern('../abc'), null);
});

test('public key validation is network aware', () => {
  assert.equal(isValidPublicKey(`0x${'a'.repeat(40)}`, 'evm'), true);
  assert.equal(isValidPublicKey('11111111111111111111111111111111', 'solana'), true);
  assert.equal(isValidPublicKey('11111111111111111111111111111111', 'evm'), false);
});

test('private key payloads are bounded', () => {
  assert.equal(isReasonablePrivateKey('x'.repeat(64)), true);
  assert.equal(isReasonablePrivateKey('x'.repeat(31)), false);
  assert.equal(isReasonablePrivateKey('x'.repeat(257)), false);
});
