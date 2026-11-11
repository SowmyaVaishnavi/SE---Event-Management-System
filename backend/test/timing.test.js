// EMS-NF-001: response timing middleware and the health endpoints.
process.env.JWT_SECRET = "test-secret";
const test = require("node:test");
const assert = require("node:assert");
const express = require("express");
const jwt = require("jsonwebtoken");
const { responseTiming, metrics, percentile, reset } = require("../middleware/timing");
const healthRoutes = require("../routes/health");

test("percentile uses the nearest-rank method", () => {
  const sorted = Array.from({ length: 10 }, (_, i) => (i + 1) * 100); // 100..1000
  assert.strictEqual(percentile(sorted, 50), 500);
  assert.strictEqual(percentile(sorted, 90), 900);
  assert.strictEqual(percentile(sorted, 100), 1000);
  assert.strictEqual(percentile([], 90), 0);
});

test("every response gets a Server-Timing header and is counted per route (ids grouped)", async () => {
  reset();
  const app = express();
  app.use(responseTiming);
  app.get("/api/events/:id", (req, res) => res.json({ ok: true }));
  app.get("/api/slow", (req, res) => setTimeout(() => res.json({ ok: true }), 50));
  app.use("/api/health", healthRoutes);
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const res = await fetch(`${base}/api/events/${"a".repeat(24)}?x=1`);
    assert.match(res.headers.get("server-timing"), /^app;dur=\d+(\.\d)?$/);
    await fetch(`${base}/api/events/${"b".repeat(24)}`);
    await fetch(`${base}/api/slow`);
    await new Promise((r) => setTimeout(r, 20));

    const m = metrics();
    assert.strictEqual(m.routes["GET /api/events/:id"].count, 2);
    assert.ok(m.routes["GET /api/slow"].max >= 45);
    assert.strictEqual(m.targetMs, 3000);
    assert.strictEqual(m.meetsTarget, true);

    // Metrics are Admin-only; plain health is public (503 here: no database in tests).
    assert.strictEqual((await fetch(`${base}/api/health/metrics`)).status, 401);
    const adminToken = jwt.sign({ id: "0".repeat(24), role: "Admin" }, process.env.JWT_SECRET);
    const asAdmin = await fetch(`${base}/api/health/metrics`, { headers: { Authorization: `Bearer ${adminToken}` } });
    assert.strictEqual(asAdmin.status, 200);
    const health = await fetch(`${base}/api/health`);
    assert.strictEqual(health.status, 503);
    assert.strictEqual((await health.json()).db, "disconnected");
  } finally {
    server.close();
  }
});
