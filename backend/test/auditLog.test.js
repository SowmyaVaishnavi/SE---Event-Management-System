// Tests for EMS-NF-004 / TC-OPS-01: event and transaction logs are kept 2+ years, old rows are archived
// automatically and can still be retrieved by an Admin. Both log collections are stubbed in memory. Run: npm test
process.env.JWT_SECRET = "test-secret";
const test = require("node:test");
const assert = require("node:assert");
const express = require("express");
const jwt = require("jsonwebtoken");
const AuditLog = require("../models/AuditLog");
const { AuditLogArchive } = AuditLog;
const audit = require("../lib/auditLog");
const auditRoutes = require("../routes/auditLogs");

const DAY = 864e5;
const oid = (n) => String(n).padStart(24, "0");
const daysAgo = (d) => new Date(Date.now() - d * DAY);

// Minimal in-memory collection: find / findOne with sort + limit, insertMany, deleteMany, countDocuments.
function memory(Model, rows) {
  const ops = { $gte: (a, b) => a >= b, $lte: (a, b) => a <= b, $lt: (a, b) => a < b, $in: (a, b) => b.map(String).includes(String(a)) };
  const ok = (r, f = {}) => Object.entries(f).every(([k, v]) =>
    v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v) && Object.keys(v).some((x) => x.startsWith("$"))
      ? Object.entries(v).every(([op, val]) => ops[op](r[k], val))
      : String(r[k]) === String(v));
  const query = (list) => {
    let out = list;
    const qy = {
      sort: (s) => { const [[k, dir]] = Object.entries(s); out = [...out].sort((a, b) => (a[k] - b[k]) * dir); return qy; },
      limit: (n) => { out = out.slice(0, n); return qy; },
      lean: () => qy,
      then: (a, b) => Promise.resolve(out.map((r) => ({ ...r }))).then(a, b),
    };
    return qy;
  };
  Model.find = (f, projection) => query(rows.filter((r) => ok(r, f)));
  Model.findOne = (f) => { const qy = query(rows.filter((r) => ok(r, f))); const t = qy.then; qy.then = (a, b) => t((list) => list[0] ?? null).then(a, b); return qy; };
  Model.countDocuments = async (f) => rows.filter((r) => ok(r, f)).length;
  Model.insertMany = async (list) => {
    const dup = list.filter((d) => rows.some((r) => String(r._id) === String(d._id)));
    list.filter((d) => !dup.includes(d)).forEach((d) => rows.push({ ...d }));
    if (dup.length) throw Object.assign(new Error("duplicate key"), { code: 11000 });
  };
  Model.deleteMany = async (f) => { for (let i = rows.length - 1; i >= 0; i--) if (ok(rows[i], f)) rows.splice(i, 1); };
  return rows;
}

const row = (n, ageDays, over = {}) => ({
  _id: oid(n), category: "event", action: "event_created", outcome: "success", occurredAt: daysAgo(ageDays),
  retainUntil: audit.retainUntilFor(daysAgo(ageDays)), archivedAt: null, ...over,
});

let recent, archive;
test.beforeEach(() => {
  recent = memory(AuditLog, [row(1, 400), row(2, 200), row(3, 100), row(4, 10), row(5, 1, { category: "payment", action: "payment_paid" })]);
  archive = memory(AuditLogArchive, []);
});
test.after(() => audit.setWriter(null));

test("TC-OPS-01: every log row is kept at least 2 years (and the setting cannot go lower)", () => {
  const t = new Date("2026-11-02T10:00:00Z");
  assert.strictEqual(audit.retainUntilFor(t).toISOString(), "2028-11-02T10:00:00.000Z");
  const days = (+audit.retainUntilFor(t) - +t) / DAY;
  assert.ok(days >= 730, `kept ${days} days`);

  process.env.LOG_RETENTION_YEARS = "1";
  assert.strictEqual(audit.retentionYears(), 2);
  process.env.LOG_RETENTION_YEARS = "5";
  assert.strictEqual(audit.retentionYears(), 5);
  delete process.env.LOG_RETENTION_YEARS;

  // A leap day does not shorten it: 29 Feb 2028 + 2 years is later than 730 days.
  assert.ok(+audit.retainUntilFor(new Date("2028-02-29T00:00:00Z")) - +new Date("2028-02-29T00:00:00Z") >= 730 * DAY);
});

test("TC-OPS-01: a recorded row carries its own retain-until date and stays in the recent collection", async () => {
  const written = [];
  audit.setWriter(async (d) => { written.push(d); });
  await audit.record({ ip: "10.0.0.1", user: { id: oid(7), role: "Organizer" } }, { category: "event", action: "event_created", target: "event:1" });
  assert.strictEqual(written.length, 1);
  const [d] = written;
  assert.deepStrictEqual([d.actor, d.role, d.ip, d.outcome], [oid(7), "Organizer", "10.0.0.1", "success"]);
  assert.ok(+d.retainUntil - +d.occurredAt >= 730 * DAY);
});

test("TC-OPS-01: archiving moves old rows to the archive and loses nothing", async () => {
  const before = recent.length + archive.length;
  const original = { ...recent.find((r) => r._id === oid(1)) };
  const { moved } = await audit.archiveOldLogs({ olderThanDays: 90 });
  assert.strictEqual(moved, 3);
  assert.deepStrictEqual(recent.map((r) => r._id), [oid(4), oid(5)]);
  assert.deepStrictEqual(archive.map((r) => r._id).sort(), [oid(1), oid(2), oid(3)]);
  assert.strictEqual(recent.length + archive.length, before);
  assert.ok(archive.every((r) => r.archivedAt instanceof Date));
  // the archive keeps the original retain-until date: archiving never shortens (or restarts) retention
  const moved1 = archive.find((r) => r._id === oid(1));
  assert.strictEqual(+moved1.retainUntil, +original.retainUntil);
  assert.strictEqual(+moved1.occurredAt, +original.occurredAt);
  assert.ok(+moved1.retainUntil - +moved1.occurredAt >= 730 * DAY);
});

test("TC-OPS-01: running the archive job again is safe", async () => {
  await audit.archiveOldLogs({ olderThanDays: 90 });
  assert.strictEqual((await audit.archiveOldLogs({ olderThanDays: 90 })).moved, 0);
  // a row that is already in the archive (a crashed earlier run) is not copied twice
  recent.push(row(2, 200));
  const res = await audit.archiveOldLogs({ olderThanDays: 90 });
  assert.strictEqual(res.moved, 1);
  assert.strictEqual(archive.filter((r) => r._id === oid(2)).length, 1);
  assert.ok(!recent.some((r) => r._id === oid(2)));
});

test("TC-OPS-01: a row is never removed from the recent collection unless it reached the archive", async () => {
  AuditLogArchive.insertMany = async () => {}; // the archive silently stores nothing
  const res = await audit.archiveOldLogs({ olderThanDays: 90 });
  assert.strictEqual(res.moved, 0);
  assert.strictEqual(recent.length, 5);
});

test("TC-OPS-01: retrieval finds archived rows too, newest first, and can be limited to recent ones", async () => {
  await audit.archiveOldLogs({ olderThanDays: 90 });

  const all = await audit.search({});
  assert.deepStrictEqual(all.logs.map((l) => l.id), [oid(5), oid(4), oid(3), oid(2), oid(1)]);
  assert.deepStrictEqual(all.logs.map((l) => l.archived), [false, false, true, true, true]);
  assert.strictEqual(all.nextBefore, null);

  const oldOnly = await audit.search({ to: daysAgo(150) });
  assert.deepStrictEqual(oldOnly.logs.map((l) => l.id), [oid(2), oid(1)]);

  const hot = await audit.search({ includeArchive: false });
  assert.deepStrictEqual(hot.logs.map((l) => l.id), [oid(5), oid(4)]);

  const pay = await audit.search({ category: "payment" });
  assert.deepStrictEqual(pay.logs.map((l) => l.action), ["payment_paid"]);
});

test("TC-OPS-01: paging walks through every row exactly once", async () => {
  await audit.archiveOldLogs({ olderThanDays: 90 });
  const seen = [];
  let before;
  for (let i = 0; i < 5; i++) {
    const page = await audit.search({ limit: 2, before });
    seen.push(...page.logs.map((l) => l.id));
    if (!page.nextBefore) break;
    before = new Date(page.nextBefore);
  }
  assert.deepStrictEqual(seen, [oid(5), oid(4), oid(3), oid(2), oid(1)]);
});

test("TC-OPS-01: status reports counts, oldest row and the retention setting", async () => {
  await audit.archiveOldLogs({ olderThanDays: 90 });
  const s = await audit.status();
  assert.deepStrictEqual([s.recent, s.archived, s.retentionYears, s.archiveAfterDays], [2, 3, 2, 90]);
  assert.strictEqual(+new Date(s.oldest), +recent.concat(archive).map((r) => r.occurredAt).sort((a, b) => a - b)[0]);
});

test("TC-Sec-03 / SAD 4.4: secrets and card numbers are stripped from log details", () => {
  const clean = audit.sanitize({
    amountPaise: 49950, provider: "sandbox", note: "paid by 4111 1111 1111 1111 today",
    password: "hunter2", authToken: "abc", nested: { signature: "s", cardNumber: "4111111111111111", ok: "fine" },
  });
  assert.strictEqual(clean.amountPaise, 49950);
  assert.strictEqual(clean.note, "[removed]");
  assert.strictEqual(clean.password, "[removed]");
  assert.strictEqual(clean.authToken, "[removed]");
  assert.deepStrictEqual(clean.nested, { signature: "[removed]", cardNumber: "[removed]", ok: "fine" });
  assert.ok(!JSON.stringify(clean).includes("4111"));
});

test("a failing log write never breaks the request that caused it", async () => {
  audit.setWriter(async () => { throw new Error("db down"); });
  const origError = console.error;
  console.error = () => {};
  try {
    await assert.doesNotReject(audit.record(null, { category: "auth", action: "login_success" }));
  } finally {
    console.error = origError;
  }
});

// ---- Admin endpoint ----
async function call(path, role) {
  const app = express();
  app.use("/api/audit-logs", auditRoutes);
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  try {
    const headers = role ? { Authorization: `Bearer ${jwt.sign({ id: oid(30), role }, process.env.JWT_SECRET)}` } : {};
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/audit-logs${path}`, { headers });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

test("TC-OPS-01: only an Admin can read the log", async () => {
  assert.strictEqual((await call("")).status, 401);
  assert.strictEqual((await call("", "Attendee")).status, 403);
  assert.strictEqual((await call("", "Organizer")).status, 403);
  assert.strictEqual((await call("", "Admin")).status, 200);
});

test("TC-OPS-01: the Admin endpoint filters, includes archived rows and rejects bad filters", async () => {
  await audit.archiveOldLogs({ olderThanDays: 90 });
  const all = await call("?limit=10", "Admin");
  assert.strictEqual(all.body.logs.length, 5);
  assert.strictEqual(all.body.logs.filter((l) => l.archived).length, 3);

  const day = daysAgo(200).toISOString().slice(0, 10);
  const oneDay = await call(`?from=${day}&to=${day}`, "Admin"); // a plain date means the whole day
  assert.deepStrictEqual(oneDay.body.logs.map((l) => l.id), [oid(2)]);

  assert.strictEqual((await call("?archived=false", "Admin")).body.logs.length, 2);
  assert.strictEqual((await call("?category=nope", "Admin")).status, 400);
  assert.strictEqual((await call("?limit=0", "Admin")).status, 400);
  assert.strictEqual((await call("?from=yesterday-ish", "Admin")).status, 400);
  assert.strictEqual((await call("?actor=123", "Admin")).status, 400);

  const status = await call("/status", "Admin");
  assert.deepStrictEqual([status.body.recent, status.body.archived, status.body.retentionYears], [2, 3, 2]);
});
