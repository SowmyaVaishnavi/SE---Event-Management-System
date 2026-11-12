const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, ".env")
});

// ...

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
const auditLogRoutes = require("./routes/auditLogs");
const { startArchiveSchedule } = require("./lib/auditLog");
const { responseTiming } = require("./middleware/timing");
const { httpsOnly, startServer: listen, truthy } = require("./lib/tls");
const { errorHandler } = require("./lib/errorHandler");

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
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api", bookingRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Event Management System API running"
  });
});

// EMS-NF-003: must come after every route. Safe JSON errors, no stack traces, no request bodies in logs.
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    const isProd = process.env.NODE_ENV === "production";

    // Dev convenience: a missing .env no longer stops the API from starting.
    if (!process.env.MONGO_URI) {
      if (isProd) throw new Error("MONGO_URI is missing from .env");
      process.env.MONGO_URI = "mongodb://localhost:27017/ems";
      console.warn("MONGO_URI not set, using mongodb://localhost:27017/ems");
    }

    if (!process.env.JWT_SECRET) {
      if (isProd) throw new Error("JWT_SECRET is missing from .env");
      process.env.JWT_SECRET = require("crypto").randomBytes(48).toString("hex");
      console.warn("JWT_SECRET not set, using a temporary one (logins reset on restart). Set it in backend/.env.");
    }

    // For a remote database use a TLS connection string (Atlas "mongodb+srv://" is TLS by default,
    // or add "?tls=true"). See docs/TLS.md.
    try {
      await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    } catch (dbError) {
      throw new Error(`Cannot reach MongoDB at ${process.env.MONGO_URI}. Start MongoDB (Windows: run "net start MongoDB" as admin, or check Services) or set MONGO_URI to an Atlas URI in backend/.env. (${dbError.message})`);
    }

    console.log("MongoDB connected successfully");
    require("./lib/reminders").startReminderSchedule();
    listen(app, { port: Number(PORT) });

    // EMS-NF-004: move old audit-log rows to the archive every day (docs/LOG_RETENTION.md).
    startArchiveSchedule();
  } catch (error) {
    console.error("Startup error:", error.message);
    process.exit(1);
  }
}

startServer();
