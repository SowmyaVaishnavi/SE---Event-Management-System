// GET /api/health (public): is the API up and the database connected. For uptime checks (NF-002).
// GET /api/health/metrics (Admin): recent response times per route vs the 3 s / 90% target (NF-001).
const express = require("express");
const mongoose = require("mongoose");
const { requireAuth, requireRole } = require("../middleware/auth");
const { metrics } = require("../middleware/timing");

const router = express.Router();

router.get("/", (req, res) => {
  const db = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.status(db === "connected" ? 200 : 503).json({ status: db === "connected" ? "ok" : "degraded", db, uptimeSeconds: Math.round(process.uptime()) });
});

router.get("/metrics", requireAuth, requireRole("Admin"), (req, res) => {
  res.json(metrics());
});

module.exports = router;
