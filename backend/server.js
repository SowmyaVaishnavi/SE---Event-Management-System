
const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, ".env")
});

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/events");
const bookingRoutes = require("./routes/bookings");
const notificationRoutes = require("./routes/notifications");
const paymentRoutes = require("./routes/payments");
const { rejectCardData } = require("./lib/cardData");
const healthRoutes = require("./routes/health");
const { responseTiming } = require("./middleware/timing");
const { httpsOnly, startServer: listen, truthy } = require("./lib/tls");

const app = express();

// EMS-NF-001: time every request (Server-Timing header, slow-request log, /api/health/metrics).
app.use(responseTiming);

// Behind a TLS proxy, trust its X-Forwarded-Proto so req.secure is correct (EMS-SR-001).
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.use(httpsOnly({ requireHttps: truthy(process.env.REQUIRE_HTTPS) }));
app.use(cors());
app.use(express.json({ limit: "10kb" }));
// EMS-SR-003: refuse any request that carries card details; card data is only ever typed on the gateway's page.
app.use(rejectCardData);

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api", bookingRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Event Management System API running"
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from .env");
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing from .env");
    }

    // For a remote database use a TLS connection string (Atlas "mongodb+srv://" is TLS by default,
    // or add "?tls=true"). See docs/TLS.md.
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully");

    listen(app, { port: Number(PORT) });
  } catch (error) {
    console.error("Startup error:", error.message);
    process.exit(1);
  }
}

startServer();
