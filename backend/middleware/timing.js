// EMS-NF-001: measure every API response so the "<= 3 s for 90% of requests" target can be checked
// (SAD 4.4 "monitor ... API uptime"). Adds a Server-Timing header, logs slow requests, and keeps
// recent durations in memory for GET /api/health/metrics. Never logs bodies or query strings.

const TARGET_MS = 3000;
const SLOW_MS = Number(process.env.SLOW_REQUEST_MS) || 1000;
const WINDOW = 1000; // recent requests kept per route

const stats = new Map(); // "GET /api/events" -> { durations: [], count, errors, slow }

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, i))];
}

// "/api/events/66f1.../register" -> "/api/events/:id/register", so stats group by route, not by id.
function routeKey(req) {
  const path = (req.originalUrl || req.url || "").split("?")[0];
  return `${req.method} ${path.replace(/\/[0-9a-f]{24}(?=\/|$)/gi, "/:id")}`;
}

function record(key, ms, status) {
  let s = stats.get(key);
  if (!s) stats.set(key, (s = { durations: [], count: 0, errors: 0, slow: 0 }));
  s.durations.push(ms);
  if (s.durations.length > WINDOW) s.durations.shift();
  s.count++;
  if (status >= 500) s.errors++;
  if (ms > SLOW_MS) s.slow++;
}

function responseTiming(req, res, next) {
  const start = process.hrtime.bigint();
  const writeHead = res.writeHead;
  // Set the header just before headers go out, when the handler's time is known.
  res.writeHead = function (...args) {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (!res.headersSent) res.setHeader("Server-Timing", `app;dur=${ms.toFixed(1)}`);
    return writeHead.apply(this, args);
  };
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const key = routeKey(req);
    record(key, ms, res.statusCode);
    if (ms > SLOW_MS) console.warn(`Slow request: ${key} ${res.statusCode} ${ms.toFixed(0)} ms`);
  });
  next();
}

function summary(durations) {
  const sorted = [...durations].sort((a, b) => a - b);
  return {
    p50: Math.round(percentile(sorted, 50)),
    p90: Math.round(percentile(sorted, 90)),
    p95: Math.round(percentile(sorted, 95)),
    max: Math.round(sorted[sorted.length - 1] || 0),
  };
}

function metrics() {
  const all = [];
  const routes = {};
  for (const [key, s] of stats) {
    all.push(...s.durations);
    routes[key] = { count: s.count, errors: s.errors, slow: s.slow, ...summary(s.durations) };
  }
  const overall = summary(all);
  return {
    targetMs: TARGET_MS,
    sample: all.length,
    overall,
    meetsTarget: overall.p90 <= TARGET_MS,
    routes,
  };
}

const reset = () => stats.clear();

module.exports = { responseTiming, metrics, percentile, reset, TARGET_MS };
