// Integration tests need a REAL MongoDB, given explicitly as MONGO_URI_TEST.
// Safety: the database name must end in "_test", because these tests drop
// that database before and after running. They never read MONGO_URI or .env.
const getTestMongoUri = () => {
  const uri = (process.env.MONGO_URI_TEST || "").trim();
  if (!uri) return null;
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/);
  const dbName = match ? decodeURIComponent(match[1]) : "";
  if (!/_test$/.test(dbName)) {
    throw new Error(
      `Refusing to run: MONGO_URI_TEST must name a database ending in "_test" (got "${dbName || "none"}"). ` +
        "Integration tests drop this database."
    );
  }
  return uri;
};

const SKIP_REASON = "MONGO_URI_TEST not set (see docs/TESTING.md)";

// Connects for an integration suite, with a clear message instead of a
// 10-second stack trace per test when MongoDB is not running.
const connectTestDb = async (connectDB) => {
  try {
    await connectDB();
  } catch (error) {
    throw new Error(
      "Cannot reach MongoDB at MONGO_URI_TEST. Start your local mongod first (see docs/TESTING.md). " +
        `Driver said: ${error.message}`
    );
  }
};

// Cleanup that is safe even when setup failed part-way.
const cleanupTestDb = async (mongoose, srv) => {
  if (srv) await srv.close();
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
};

module.exports = { getTestMongoUri, SKIP_REASON, connectTestDb, cleanupTestDb };
