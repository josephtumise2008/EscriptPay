// Database backups from this computer.
//
//   Make a locked backup file now (nothing is emailed or changed):
//     npm run backup:make -- --db atlas
//
//   Open a backup and show what's inside (changes nothing):
//     npm run backup:restore -- --file ~/Downloads/escriptpay-backup-2026-11-19.epbk
//
//   Restore it into a database (asks you to type a confirmation first):
//     npm run backup:restore -- --file <file> --db local --apply
//     npm run backup:restore -- --file <file> --db atlas --apply
//   A collection that already has records is only replaced with --replace.
//
// The backup password is BACKUP_PASSPHRASE (environment or backend/.env.atlas),
// otherwise you're asked for it. It is never printed.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { readPrivate, ask, askHidden, flag, option } = require("./lib/privateEnv");
const { connect } = require("./lib/db");
const { encryptBackup, decryptBackup, checkPassphrase } = require("../src/services/backupCrypto");

const mode = process.argv[2];
const expand = (p) => (p && p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p);

const passphrase = async () => {
  const p = readPrivate("BACKUP_PASSPHRASE") || (await askHidden("Backup password (BACKUP_PASSPHRASE): ")).trim();
  checkPassphrase(p);
  return p;
};

const make = async () => {
  const pass = await passphrase();
  const mongoose = await connect(option("db") || "atlas");
  const { snapshot } = require("../src/services/backup");
  const { json, counts, createdAt } = await snapshot();
  const file = path.resolve(expand(option("out")) || `escriptpay-backup-${createdAt.slice(0, 10)}.epbk`);
  fs.writeFileSync(file, encryptBackup(json, pass), { mode: 0o600 });
  console.log(`\nSaved ${file}`);
  for (const [name, n] of Object.entries(counts)) console.log(`  ${name.padEnd(16)} ${n}`);
  await mongoose.disconnect();
};

const restore = async () => {
  const file = expand(option("file"));
  if (!file || !fs.existsSync(file)) throw new Error("Give the backup file with --file <path>.");
  const pass = await passphrase();
  const { EJSON } = require("mongoose").mongo.BSON;
  const data = EJSON.parse(decryptBackup(fs.readFileSync(file), pass), { relaxed: false });
  console.log(`\nBackup of "${data.database}" made ${data.createdAt}`);
  for (const [name, n] of Object.entries(data.counts)) console.log(`  ${name.padEnd(16)} ${n}`);

  if (!flag("apply")) {
    console.log("\nNothing was changed. Add --db local|atlas --apply to restore it into a database.");
    return;
  }
  const target = option("db");
  if (!["local", "atlas"].includes(target)) throw new Error("Add --db local or --db atlas.");
  const mongoose = await connect(target);
  const db = mongoose.connection.db;
  const existing = {};
  for (const name of Object.keys(data.collections)) existing[name] = await db.collection(name).countDocuments();
  const busy = Object.entries(existing).filter(([, n]) => n > 0);
  if (busy.length && !flag("replace")) {
    console.log(`\nThese collections in "${db.databaseName}" already have records:`);
    busy.forEach(([name, n]) => console.log(`  ${name}: ${n}`));
    console.log("Nothing was changed. Restore into an empty database, or add --replace to overwrite them.");
    await mongoose.disconnect();
    return;
  }
  const phrase = `RESTORE ${db.databaseName}`;
  const typed = await ask(`\nThis ${busy.length ? "REPLACES" : "fills"} the ${target} database "${db.databaseName}". Type "${phrase}" to continue: `);
  if (typed.trim() !== phrase) {
    console.log("Cancelled. Nothing was changed.");
    await mongoose.disconnect();
    return;
  }
  for (const [name, docs] of Object.entries(data.collections)) {
    const col = db.collection(name);
    if (existing[name] > 0) await col.deleteMany({});
    if (docs.length) await col.insertMany(docs, { ordered: false });
    console.log(`  restored ${name}: ${docs.length}`);
  }
  console.log("\nDone.");
  await mongoose.disconnect();
};

(mode === "make" ? make() : mode === "restore" ? restore() : Promise.reject(new Error("Use backup:make or backup:restore.")))
  .catch((error) => {
    console.error(`\nStopped: ${error.message}`);
    process.exit(1);
  });
