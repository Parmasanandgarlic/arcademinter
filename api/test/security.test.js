const test = require('node:test');
const assert = require('node:assert/strict');
const { constantTimeEqual } = require('../security');
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
