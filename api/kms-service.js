const AWS = require('aws-sdk');
const crypto = require('crypto');
require('dotenv').config();
const ALGORITHM = 'aes-256-gcm';
AWS.config.update({
  region: process.env.AWS_REGION,
});
const kms = new AWS.KMS();
const KmsKeyId = process.env.KMS_KEY_ID;
async function encryptKey(privateKey) {
  const dataKeyParams = {
    KeyId: KmsKeyId,
    KeySpec: 'AES_256',
  };
  const { Plaintext, CiphertextBlob } = await kms.generateDataKey(dataKeyParams).promise();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, Plaintext, iv);
  let encryptedPrivateKey = cipher.update(privateKey, 'utf8', 'base64');
  encryptedPrivateKey += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  return {
    encryptedDataKey: CiphertextBlob.toString('base64'),
    encryptedPrivateKey: encryptedPrivateKey,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}
async function decryptKey(payload) {
  const { encryptedDataKey, encryptedPrivateKey, iv, authTag } = payload;
  const decryptParams = {
    CiphertextBlob: Buffer.from(encryptedDataKey, 'base64'),
  };
  const { Plaintext } = await kms.decrypt(decryptParams).promise();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Plaintext,
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  let decrypted = decipher.update(encryptedPrivateKey, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
module.exports = { encryptKey, decryptKey };

