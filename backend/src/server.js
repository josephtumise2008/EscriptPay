const dns = require("dns");

dns.setServers(["1.1.1.1", "8.8.8.8"]);

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");
const planRoutes = require("./routes/planRoutes");
const networkRoutes = require("./routes/networkRoutes");
const authRoutes = require("./routes/authRoutes");
const transactionRoutes = require("./routes/transactionRoutes");

const app = express();
const PORT = process.env.PORT || 5001;

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({
    message: "EscriptPay API is running 🚀",
    mode: "test",
  });
});

app.get("/api/health", (req, res) => {
  res.json({ success: true, status: "ok", mode: "test" });
});

app.use("/api/plans", planRoutes);
app.use("/api/networks", networkRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

connectDB();

app.listen(PORT, () => {
  console.log(`EscriptPay backend running on http://localhost:${PORT}`);
});