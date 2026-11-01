// TC-Perf-01 / EMS-NF-001: load test. No extra packages; uses Node's fetch.
// Runs N virtual users for a fixed time against a running API with a realistic mix of requests
// and checks that the 90th percentile response time is <= 3 s. Exit code 1 if it is not.
//
//   npm run perf -- --url http://localhost:5000 --users 50 --seconds 30
//   npm run perf -- --users 500 --seconds 90 --ramp 60 --report ../docs/perf/run-500.json
//
// --ramp N: users arrive evenly over N seconds (default 5). A short ramp is a "login storm" where
// everyone logs in at once; a longer ramp is closer to normal use (a login token lasts a day).
//
// Needs data: run `npm run seed:perf` first (events, attendees and bookings in the database).
const fs = require("fs");
const path = require("path");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

const BASE = arg("url", process.env.PERF_URL || "http://localhost:5000");
const USERS = Number(arg("users", 50));
const SECONDS = Number(arg("seconds", 30));
const REPORT = arg("report", "");
const RAMP = Number(arg("ramp", 5));
const TARGET_MS = 3000;
const PASSWORD = "perf-test-password";
const CATEGORIES = ["Technical", "Cultural", "Sports", "Workshop", "Seminar", "Social", "Other"];

if (BASE.startsWith("https://localhost") || BASE.startsWith("https://127.0.0.1")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // self-signed dev certificate (docs/TLS.md)
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const results = [];

async function timed(name, method, url, { token, body } = {}) {
  const headers = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const start = performance.now();
  let status = 0;
  let data = null;
  try {
    const res = await fetch(BASE + url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
    status = res.status;
    data = await res.json().catch(() => null);
  } catch {
    status = 0;
  }
  results.push({ name, ms: performance.now() - start, ok: status > 0 && status < 500 });
  return { status, data };
}

// One virtual attendee: logs in once, then browses like a person would until time is up.
async function virtualUser(n, deadline, eventIds) {
  const login = await timed("POST /api/auth/login", "POST", "/api/auth/login", {
    body: { email: `perf.attendee${n % 200}@perf.test`, password: PASSWORD },
  });
  const token = login.data?.token;
  while (Date.now() < deadline) {
    const roll = Math.random();
    if (roll < 0.45) await timed("GET /api/events", "GET", "/api/events");
    else if (roll < 0.65) await timed("GET /api/events?filters", "GET", `/api/events?category=${pick(CATEGORIES)}&location=hall`);
    else if (roll < 0.8) await timed("GET /api/events/:id", "GET", `/api/events/${pick(eventIds)}`);
    else if (roll < 0.9 && token) await timed("GET /api/bookings/me", "GET", "/api/bookings/me", { token });
    else if (token) await timed("GET /api/notifications/me", "GET", "/api/notifications/me", { token });
    // Think time 0.2-1 s between clicks.
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 800));
  }
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

function stats(list) {
  const sorted = list.map((r) => r.ms).sort((a, b) => a - b);
  return {
    requests: list.length,
    errors: list.filter((r) => !r.ok).length,
    p50: Math.round(pct(sorted, 50)),
    p90: Math.round(pct(sorted, 90)),
    p95: Math.round(pct(sorted, 95)),
    max: Math.round(sorted[sorted.length - 1] || 0),
  };
}

async function main() {
  const list = await fetch(`${BASE}/api/events`).then((r) => r.json()).catch(() => null);
  const eventIds = (list?.events ?? []).map((e) => e.eventId);
  if (!eventIds.length) {
    console.error(`No events at ${BASE}/api/events. Start the API and run "npm run seed:perf" first.`);
    process.exit(1);
  }

  console.log(`TC-Perf-01: ${USERS} users arriving over ${RAMP}s, ${SECONDS}s in total, against ${BASE} (${eventIds.length} events)`);
  const started = Date.now();
  const deadline = started + SECONDS * 1000;
  // Users arrive evenly over the ramp time rather than all in the same millisecond.
  await Promise.all(Array.from({ length: USERS }, (_, n) =>
    new Promise((r) => setTimeout(r, (n / USERS) * Math.min(RAMP * 1000, SECONDS * 1000))).then(() => virtualUser(n, deadline, eventIds))));
  const elapsed = (Date.now() - started) / 1000;

  const overall = stats(results);
  const byName = {};
  for (const name of [...new Set(results.map((r) => r.name))].sort()) byName[name] = stats(results.filter((r) => r.name === name));
  const pass = overall.p90 <= TARGET_MS && overall.errors === 0;

  console.log(`\n${"Request".padEnd(28)} ${"count".padStart(6)} ${"err".padStart(4)} ${"p50".padStart(6)} ${"p90".padStart(6)} ${"p95".padStart(6)} ${"max".padStart(6)}  (ms)`);
  for (const [name, s] of Object.entries({ ...byName, ALL: overall })) {
    console.log(`${name.padEnd(28)} ${String(s.requests).padStart(6)} ${String(s.errors).padStart(4)} ${String(s.p50).padStart(6)} ${String(s.p90).padStart(6)} ${String(s.p95).padStart(6)} ${String(s.max).padStart(6)}`);
  }
  console.log(`\nThroughput: ${(overall.requests / elapsed).toFixed(1)} requests/s`);
  console.log(`Result: 90th percentile ${overall.p90} ms vs target ${TARGET_MS} ms, ${overall.errors} errors -> ${pass ? "PASS" : "FAIL"}`);

  if (REPORT) {
    const file = path.resolve(process.cwd(), REPORT);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({
      test: "TC-Perf-01", requirement: "EMS-NF-001", date: new Date().toISOString(), url: BASE,
      users: USERS, seconds: SECONDS, rampSeconds: RAMP, targetMs: TARGET_MS, throughputPerSecond: Number((overall.requests / elapsed).toFixed(1)),
      overall, byRequest: byName, pass, node: process.version,
    }, null, 2) + "\n");
    console.log(`Report written to ${file}`);
  }
  process.exit(pass ? 0 : 1);
}

main();
