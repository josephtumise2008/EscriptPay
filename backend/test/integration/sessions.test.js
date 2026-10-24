// Integration: forced logout and password changes end old sessions.
const test = require("node:test");
const assert = require("node:assert/strict");
const { getTestMongoUri, SKIP_REASON, connectTestDb, cleanupTestDb } = require("../helpers/testDb");

const uri = getTestMongoUri();
const skip = uri ? false : SKIP_REASON;

process.env.NODE_ENV = "test";
process.env.MONGO_URI = uri || "mongodb://127.0.0.1:1/unused_test";
process.env.JWT_SECRET = "integration-jwt-secret";
process.env.PAYMENT_SERVICE = "test";
process.env.VTU_SERVICE = "test";

const mongoose = require("mongoose");
const app = require("../../src/server");
const connectDB = require("../../src/config/db");
const User = require("../../src/models/User");
const { startServer, createClient } = require("../helpers/server");

let srv;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const signup = async (email) => {
  const c = createClient(srv.baseUrl);
  const r = await c.post("/api/auth/signup", { name: "Some User", email, phone: "08012345678", password: "password123" });
  assert.equal(r.status, 201);
  return c;
};

test.before(async () => {
  if (skip) return;
  await connectTestDb(connectDB);
  await mongoose.connection.dropDatabase();
  srv = await startServer(app);
});

test.after(async () => {
  if (skip) return;
  await cleanupTestDb(mongoose, srv);
});

test("forced logout signs out everyone except the kept account", { skip }, async () => {
  const keep = await signup("owner@example.com");
  const other = await signup("customer@example.com");
  await wait(1100); // tokens carry whole seconds
  await User.updateMany({ email: { $ne: "owner@example.com" } }, { $set: { sessionsValidAfter: new Date() } });

  assert.equal((await keep.get("/api/auth/me")).status, 200);
  assert.equal((await other.get("/api/auth/me")).status, 401);

  const again = createClient(srv.baseUrl);
  assert.equal((await again.post("/api/auth/login", { email: "customer@example.com", password: "password123" })).status, 200);
  assert.equal((await again.get("/api/auth/me")).status, 200, "logging in again works");
});

test("changing the password signs out other devices but not this one", { skip }, async () => {
  const phone = await signup("two@example.com");
  const laptop = createClient(srv.baseUrl);
  assert.equal((await laptop.post("/api/auth/login", { email: "two@example.com", password: "password123" })).status, 200);
  await wait(1100);

  const r = await phone.post("/api/auth/change-password", { currentPassword: "password123", newPassword: "newpassword456" });
  assert.equal(r.status, 200);
  assert.equal((await phone.get("/api/auth/me")).status, 200);
  assert.equal((await laptop.get("/api/auth/me")).status, 401);
});
