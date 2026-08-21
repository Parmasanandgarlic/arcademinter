const AWS = require('aws-sdk');
const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-gcm';
AWS.config.update({ region: process.env.AWS_REGION });
const kms = new AWS.KMS();
const KMS_KEY_ID = process.env.KMS_KEY_ID;

async function encryptKey(privateKey) {
  const { Plaintext, CiphertextBlob } = await kms.generateDataKey({
    KeyId: KMS_KEY_ID,
    KeySpec: 'AES_256',
  }).promise();

  const dataKey = Buffer.from(Plaintext);
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, dataKey, iv);
    const encryptedPrivateKey = Buffer.concat([
      cipher.update(Buffer.from(privateKey, 'utf8')),
      cipher.final(),
    ]);

    return {
      encryptedDataKey: Buffer.from(CiphertextBlob).toString('base64'),
      encryptedPrivateKey: encryptedPrivateKey.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  } finally {
    dataKey.fill(0);
  }
}

async function decryptKey(payload) {
  const { encryptedDataKey, encryptedPrivateKey, iv, authTag } = payload;
  const { Plaintext } = await kms.decrypt({
    CiphertextBlob: Buffer.from(encryptedDataKey, 'base64'),
  }).promise();

  const dataKey = Buffer.from(Plaintext);
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, dataKey, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedPrivateKey, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } finally {
    dataKey.fill(0);
  }
}

module.exports = { encryptKey, decryptKey };
