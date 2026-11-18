// Daily database backup: every collection is copied, compressed, locked with
// BACKUP_PASSPHRASE and emailed to the owner as an attachment (the database is
// small, so the owner's inbox becomes a free, dated backup history).
const mongoose = require("mongoose");
const { encryptBackup, checkPassphrase } = require("./backupCrypto");
const { sendEmail } = require("./email");
const { logEvent } = require("../utils/logger");

const { EJSON } = mongoose.mongo.BSON;
const MAX_ATTACHMENT_BYTES = 30 * 1024 * 1024; // Resend allows 40 MB per email.

// -> { json, counts: { collection: n }, createdAt }
const snapshot = async () => {
  const db = mongoose.connection.db;
  const createdAt = new Date().toISOString();
  const collections = {};
  const counts = {};
  const infos = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const { name } of infos.sort((a, b) => a.name.localeCompare(b.name))) {
    if (name.startsWith("system.")) continue;
    const docs = await db.collection(name).find({}).toArray();
    collections[name] = docs;
    counts[name] = docs.length;
  }
  const json = EJSON.stringify({ app: "EscriptPay", version: 1, database: db.databaseName, createdAt, counts, collections }, { relaxed: false });
  return { json, counts, createdAt };
};

const recipients = async () => {
  const fromEnv = (process.env.BACKUP_EMAIL || process.env.ALERT_EMAIL || "").split(",").map((e) => e.trim()).filter(Boolean);
  if (fromEnv.length) return fromEnv;
  const User = require("../models/User");
  return (await User.find({ role: "admin" }).select("email").lean()).map((u) => u.email).filter(Boolean);
};

// Makes the backup and emails it. Throws on any failure (the caller alerts).
const runBackup = async () => {
  const passphrase = (process.env.BACKUP_PASSPHRASE || "").trim();
  checkPassphrase(passphrase);
  const { json, counts, createdAt } = await snapshot();
  const file = encryptBackup(json, passphrase);
  if (file.length > MAX_ATTACHMENT_BYTES) {
    throw Object.assign(new Error(`Backup is ${(file.length / 1048576).toFixed(1)} MB, too big to email.`), { code: "too_big" });
  }
  const to = await recipients();
  if (!to.length) throw Object.assign(new Error("No backup email address."), { code: "no_recipient" });

  const day = createdAt.slice(0, 10);
  const filename = `escriptpay-backup-${day}.epbk`;
  const lines = Object.entries(counts).map(([name, n]) => `${name}: ${n}`);
  const text = `EscriptPay database backup for ${day}.\n\nThe attached file is locked with your BACKUP_PASSPHRASE. Keep this email.\nTo restore: npm run backup:restore -- --file ${filename}\n\nRecords:\n${lines.join("\n")}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a"><p><b>EscriptPay database backup for ${day}</b></p><p>The attached file is locked with your backup password. Keep this email.</p><p style="color:#64748b">Records: ${lines.join(" · ")}</p></div>`;

  let sent = 0;
  for (const address of to) {
    const r = await sendEmail({
      to: address,
      subject: `EscriptPay backup ${day}`,
      text,
      html,
      attachments: [{ filename, content: file.toString("base64") }],
    });
    if (r.sent) sent += 1;
  }
  if (!sent) throw Object.assign(new Error("The backup email could not be sent."), { code: "email_not_sent" });
  logEvent("backup.done", { bytes: file.length, counts });
  return { bytes: file.length, counts, filename, sentTo: sent };
};

module.exports = { runBackup, snapshot };
