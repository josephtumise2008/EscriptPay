// Connects an admin script to MongoDB. --db local uses backend/.env;
// --db atlas uses MONGO_URI / backend/.env.atlas / a hidden prompt.
// mongodb+srv lookups that fail on some networks are retried with public DNS.
const fs = require("fs");
const path = require("path");
const dns = require("dns");
const mongoose = require("mongoose");
const { readPrivate, askHidden } = require("./privateEnv");

const resolveUri = async (db) => {
  if (db === "local") {
    const file = path.join(__dirname, "..", "..", ".env");
    const line = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/).find((l) => l.trim().startsWith("MONGO_URI=")) : null;
    const uri = line ? line.trim().slice("MONGO_URI=".length).trim().replace(/^["']|["']$/g, "") : "";
    if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri)) throw new Error("--db local expects backend/.env MONGO_URI to point at this computer.");
    return uri;
  }
  if (db === "atlas") {
    let uri = readPrivate("MONGO_URI");
    if (!uri) uri = (await askHidden("Paste the MongoDB Atlas connection string (it won't show): ")).trim();
    if (!/^mongodb(\+srv)?:\/\//.test(uri) || /[<>]/.test(uri)) throw new Error("That isn't a valid connection string.");
    return uri;
  }
  throw new Error("Choose --db local or --db atlas.");
};

const connect = async (db) => {
  const uri = await resolveUri(db);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  } catch (error) {
    if (!/querySrv|ENOTFOUND|ETIMEOUT|ECONNREFUSED/i.test(String(error && error.message))) throw error;
    console.log("Retrying the database lookup with public DNS…");
    await mongoose.disconnect().catch(() => {});
    dns.setServers(["1.1.1.1", "8.8.8.8"]);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  }
  return mongoose;
};

module.exports = { connect };
