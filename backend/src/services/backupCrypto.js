// Backup file format (all binary):
//   "EPBK1" | salt (16 bytes) | iv (12 bytes) | auth tag (16 bytes) | ciphertext
// The plaintext is gzip-compressed Extended JSON of every collection. The key
// is derived from BACKUP_PASSPHRASE with scrypt, and AES-256-GCM both hides
// the data and detects any change to the file (a tampered or truncated
// backup fails to open instead of restoring garbage).
const crypto = require("crypto");
const zlib = require("zlib");

const MAGIC = Buffer.from("EPBK1");
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const deriveKey = (passphrase, salt) => crypto.scryptSync(String(passphrase), salt, 32, SCRYPT);

const checkPassphrase = (passphrase) => {
  if (typeof passphrase !== "string" || passphrase.trim().length < 16) {
    throw Object.assign(new Error("BACKUP_PASSPHRASE must be at least 16 characters."), { code: "weak_passphrase" });
  }
};

const encryptBackup = (jsonText, passphrase) => {
  checkPassphrase(passphrase);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  const body = Buffer.concat([cipher.update(zlib.gzipSync(Buffer.from(jsonText, "utf8"), { level: 9 })), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
};

const decryptBackup = (file, passphrase) => {
  if (!Buffer.isBuffer(file) || file.length < 49 || !file.subarray(0, 5).equals(MAGIC)) {
    throw Object.assign(new Error("This isn't an EscriptPay backup file."), { code: "bad_file" });
  }
  const salt = file.subarray(5, 21);
  const iv = file.subarray(21, 33);
  const tag = file.subarray(33, 49);
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  let packed;
  try {
    packed = Buffer.concat([decipher.update(file.subarray(49)), decipher.final()]);
  } catch {
    throw Object.assign(new Error("Wrong backup password, or the file is damaged."), { code: "bad_password" });
  }
  return zlib.gunzipSync(packed).toString("utf8");
};

module.exports = { encryptBackup, decryptBackup, checkPassphrase };
