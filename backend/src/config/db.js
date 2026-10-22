const mongoose = require("mongoose");

// One connection promise per warm process. On Vercel every function instance
// connects lazily on its first request instead of at build/import time, and the
// promise is cached so concurrent requests share a single connect().
let connectionPromise = null;

const isProduction = () => Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";

const getMongoUri = () => {
  const uri = process.env.MONGO_URI;
  if (uri) return uri;

  // Never fall back to a localhost database outside local development.
  if (isProduction()) {
    throw new Error(
      "MONGO_URI is not set. Add the MongoDB Atlas connection string as the MONGO_URI environment variable."
    );
  }
  throw new Error(
    "MONGO_URI is not set. Copy backend/.env.example to backend/.env and set MONGO_URI for local development."
  );
};

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    // Throws a clear error when MONGO_URI is missing — the URI itself is never logged.
    const uri = getMongoUri();

    connectionPromise = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 10000 })
      .then(() => {
        console.log("MongoDB connected successfully");
        return mongoose.connection;
      })
      .catch((error) => {
        connectionPromise = null;
        // Message only: never log the connection string or credentials.
        console.error("MongoDB connection failed:", error.message);
        throw error;
      });
  }

  return connectionPromise;
};

module.exports = connectDB;
