const dns = require("dns");

// Local-only DNS override so mongoose can resolve hosts on machines where the
// system resolver misbehaves. Skipped on Vercel, where the platform resolver is used.
if (!process.env.VERCEL) {
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
}

require("dotenv").config();

// Fail fast on Vercel when required secrets are missing. Only variable names
// are printed — never their values.
if (process.env.VERCEL) {
  const missing = ["MONGO_URI", "JWT_SECRET"].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Add them in the Vercel project Environment Variables and redeploy."
    );
  }
}

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");
const planRoutes = require("./routes/planRoutes");
const networkRoutes = require("./routes/networkRoutes");
const authRoutes = require("./routes/authRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const { rateLimit } = require("./middleware/rateLimit");

const app = express();
const PORT = process.env.PORT || 5001;

// Comma-separated list of browser origins allowed to send credentialed
// requests (CORS). Defaults to the local Next.js dev server so local
// development works out of the box; set CLIENT_ORIGIN to the deployed
// frontend origin in Vercel. Frontend and backend share one domain in
// production, so those calls are same-origin and do not depend on CORS.
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Requests without an Origin header (curl, server-to-server) are allowed.
      if (!origin) return callback(null, true);
      callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Rate limiting (in-memory, per IP). Auth endpoints are the highest-risk
// target for brute force and enumeration, so they get the tightest limits.
// Values are generous enough for normal single-user use and the test suites
// while still stopping unbounded abuse.
app.use("/api/auth", rateLimit({ windowMs: 60 * 1000, max: 30, namespace: "auth" }));
app.use(
  "/api/transactions",
  rateLimit({ windowMs: 60 * 1000, max: 60, namespace: "purchase" })
);

// Health endpoints (no database access, safe to answer during a DB outage).
app.get(["/", "/api/"], (req, res) => {
  res.json({
    message: "EscriptPay API is running",
    status: "ok",
    mode: "test",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "EscriptPay API is running",
    status: "ok",
    mode: "test",
  });
});

// Every data-bearing route below needs MongoDB. Connecting lazily (and
// caching the connection) keeps cold starts short and lets a missing or
// unreachable database return a clear 503 instead of crashing the process.
app.use("/api", async (req, res, next) => {
  try {
    await connectDB();
    return next();
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: "Database unavailable. Please try again shortly.",
    });
  }
});

app.use("/api/plans", planRoutes);
app.use("/api/networks", networkRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// Vercel (Express service) imports this module and uses the exported app —
// it must not call listen(). Local development still starts a real server on
// port 5001 via `npm run dev`.
const startLocalServer = async () => {
  try {
    await connectDB();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`EscriptPay backend running on http://localhost:${PORT}`);
  });
};

if (require.main === module) {
  startLocalServer();
}

module.exports = app;
