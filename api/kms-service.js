const crypto = require('crypto');
const {
  KMSClient,
  GenerateDataKeyCommand,
  DecryptCommand,
} = require('@aws-sdk/client-kms');
require('dotenv').config();

const ALGORITHM = 'aes-256-gcm';

function requireBytes(value, message) {
  if (!(value instanceof Uint8Array) || value.byteLength === 0) {
    throw new Error(message);
  }
  return value;
}

function zeroBytes(value) {
  if (!(value instanceof Uint8Array)) return;
  Buffer.from(value.buffer, value.byteOffset, value.byteLength).fill(0);
}

function createKmsService({ client, keyId }) {
  if (!client || typeof client.send !== 'function') {
    throw new TypeError('A KMS client with send(command) is required.');
  }

  async function encryptKey(privateKey) {
    if (typeof keyId !== 'string' || keyId.trim().length === 0) {
      throw new Error('KMS_KEY_ID must be configured before key encryption.');
    }

    const response = await client.send(new GenerateDataKeyCommand({
      KeyId: keyId,
      KeySpec: 'AES_256',
    }));
    const plaintext = requireBytes(
      response.Plaintext,
      'KMS GenerateDataKey response was incomplete.',
    );
    const ciphertextBlob = requireBytes(
      response.CiphertextBlob,
      'KMS GenerateDataKey response was incomplete.',
    );

    const dataKey = Buffer.from(plaintext);
    try {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(ALGORITHM, dataKey, iv);
      const encryptedPrivateKey = Buffer.concat([
        cipher.update(Buffer.from(privateKey, 'utf8')),
        cipher.final(),
      ]);

      return {
        encryptedDataKey: Buffer.from(ciphertextBlob).toString('base64'),
        encryptedPrivateKey: encryptedPrivateKey.toString('base64'),
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64'),
      };
    } finally {
      dataKey.fill(0);
      zeroBytes(plaintext);
    }
  }

  async function decryptKey(payload) {
    const { encryptedDataKey, encryptedPrivateKey, iv, authTag } = payload || {};
    const response = await client.send(new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedDataKey, 'base64'),
    }));
    const plaintext = requireBytes(
      response.Plaintext,
      'KMS Decrypt response was incomplete.',
    );

    const dataKey = Buffer.from(plaintext);
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, dataKey, Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(authTag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedPrivateKey, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } finally {
      dataKey.fill(0);
      zeroBytes(plaintext);
    }
  }

  return { encryptKey, decryptKey };
}

const defaultClient = new KMSClient({ region: process.env.AWS_REGION });
const defaultService = createKmsService({
  client: defaultClient,
  keyId: process.env.KMS_KEY_ID,
});

module.exports = {
  createKmsService,
  encryptKey: defaultService.encryptKey,
  decryptKey: defaultService.decryptKey,
};
