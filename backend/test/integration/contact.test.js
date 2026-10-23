// Integration: website contact form (POST /api/contact).
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
const ContactMessage = require("../../src/models/ContactMessage");
const { startServer, createClient } = require("../helpers/server");

let srv;

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

test("contact form validates, stores real messages and ignores the honeypot", { skip }, async () => {
  const c = createClient(srv.baseUrl);
  assert.equal((await c.post("/api/contact", { name: "A", email: "a@b.co", message: "Hello there, testing" })).status, 400);
  assert.equal((await c.post("/api/contact", { name: "Ada", email: "not-an-email", message: "Hello there, testing" })).status, 400);

  const ok = await c.post("/api/contact", { name: "Ada Obi", email: "Ada@Example.com", message: "My MTN data did not arrive." });
  assert.equal(ok.status, 201);

  const bot = await c.post("/api/contact", { name: "Bot", email: "bot@spam.io", message: "Buy cheap stuff now!!", website: "http://spam" });
  assert.equal(bot.status, 201);

  const stored = await ContactMessage.find();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].email, "ada@example.com");
  assert.equal(stored[0].status, "new");
});
