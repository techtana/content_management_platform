const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const PREFIX = 'enc:';

function getKey() {
  const raw = process.env.CMS_SECRET_KEY || 'default-dev-secret-key-change-me!!';
  return crypto.createHash('sha256').update(raw).digest();
}

function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(ciphertext) {
  if (!ciphertext.startsWith(PREFIX)) return ciphertext;
  const key = getKey();
  const buf = Buffer.from(ciphertext.slice(PREFIX.length), 'base64');
  const iv = buf.slice(0, IV_LEN);
  const tag = buf.slice(IV_LEN, IV_LEN + TAG_LEN);
  const encrypted = buf.slice(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

module.exports = { encrypt, decrypt };
