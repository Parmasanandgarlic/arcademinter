const test = require('node:test');
const assert = require('node:assert/strict');

const { createKmsService } = require('../kms-service');

const PLAINTEXT_KEY = Buffer.alloc(32, 0x42);
const WRAPPED_KEY = Buffer.from('synthetic-kms-ciphertext');

test('KMS service uses an injected v3-style client and round-trips encrypted private keys', async () => {
  const calls = [];
  const client = {
    async send(command) {
      calls.push({ name: command.constructor.name, input: command.input });
      if (command.constructor.name === 'GenerateDataKeyCommand') {
        return {
          Plaintext: Buffer.from(PLAINTEXT_KEY),
          CiphertextBlob: Buffer.from(WRAPPED_KEY),
        };
      }
      if (command.constructor.name === 'DecryptCommand') {
        assert.deepEqual(Buffer.from(command.input.CiphertextBlob), WRAPPED_KEY);
        return { Plaintext: Buffer.from(PLAINTEXT_KEY) };
      }
      throw new Error(`Unexpected command: ${command.constructor.name}`);
    },
  };

  const service = createKmsService({ client, keyId: 'alias/arcademinter-test' });
  const privateKey = `0x${'11'.repeat(32)}`;

  const encrypted = await service.encryptKey(privateKey);
  assert.notEqual(encrypted.encryptedPrivateKey, Buffer.from(privateKey).toString('base64'));
  assert.equal(await service.decryptKey(encrypted), privateKey);

  assert.deepEqual(
    calls.map(({ name }) => name),
    ['GenerateDataKeyCommand', 'DecryptCommand'],
  );
  assert.equal(calls[0].input.KeyId, 'alias/arcademinter-test');
  assert.equal(calls[0].input.KeySpec, 'AES_256');
});

test('KMS service fails closed when KMS responses omit required key material', async () => {
  const client = { async send() { return {}; } };
  const service = createKmsService({ client, keyId: 'alias/arcademinter-test' });

  await assert.rejects(
    () => service.encryptKey('synthetic-private-key-material'),
    /KMS GenerateDataKey response was incomplete/,
  );
});

test('KMS plaintext is zeroed when GenerateDataKey returns only partial key material', async () => {
  const plaintext = Buffer.alloc(32, 0x7a);
  const client = {
    async send() {
      return { Plaintext: plaintext };
    },
  };
  const service = createKmsService({ client, keyId: 'alias/arcademinter-test' });

  await assert.rejects(
    () => service.encryptKey('synthetic-private-key-material'),
    /KMS GenerateDataKey response was incomplete/,
  );
  assert.equal(plaintext.every((byte) => byte === 0), true);
});
