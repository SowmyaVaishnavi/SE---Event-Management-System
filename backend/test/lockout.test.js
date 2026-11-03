// Tests for EMS-SR-005 / TC-Sec-05: account lockout after repeated failed logins, and authentication events in the log.
// The User model is stubbed in memory (the real schema and bcrypt hook still run); no MongoDB needed. Run: npm test
process.env.JWT_SECRET = "test-secret";
process.env.BCRYPT_ROUNDS = "4";
process.env.LOGIN_MAX_ATTEMPTS = "3";
process.env.LOGIN_LOCK_MINUTES = "15";
const test = require("node:test");
const assert = require("node:assert");
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authRoutes = require("../routes/authRoutes");
const { requireAuth, requireRole } = require("../middleware/auth");
const audit = require("../lib/auditLog");

let users, logs;
const q = (value) => ({ select: () => q(value), lean: () => q(value), then: (a, b) => Promise.resolve(value).then(a, b) });
const matches = (u, f) => (f.$or ? f.$or.some((g) => matches(u, g)) : Object.entries(f).every(([k, v]) => u[k] === v));
const apply = (f, u) => {
  const doc = users.find((x) => String(x._id) === String(f._id));
  if (doc) {
    for (const [k, v] of Object.entries(u.$inc || {})) doc[k] = (doc[k] || 0) + v;
    Object.assign(doc, u.$set || {});
  }
  return doc ?? null;
};

test.beforeEach(() => {
  users = [];
  logs = [];
  audit.setWriter(async (doc) => { logs.push(doc); });
  User.findOne = (f) => q(users.find((u) => matches(u, f)) ?? null);
  User.findById = (id) => q(users.find((u) => String(u._id) === String(id)) ?? null);
  User.findOneAndUpdate = async (f, u) => apply(f, u);
  User.updateOne = async (f, u) => ({ matchedCount: apply(f, u) ? 1 : 0 });
  User.create = async (data) => {
    const doc = new User(data);
    await doc.validate();
    await User.schema.s.hooks.execPre("save", doc, []);
    users.push(doc);
    return doc;
  };
});
test.after(() => audit.setWriter(null));

async function call(method, path, { body, token } = {}) {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.get("/admin-only", requireAuth, requireRole("Admin"), (req, res) => res.json({ ok: true }));
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  try {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, headers: res.headers, body: await res.json() };
  } finally {
    server.close();
  }
}

const asha = { name: "Asha", email: "asha@example.com", username: "asha_k", password: "secret-pass-1", role: "Attendee" };
const login = (username, password) => call("POST", "/api/auth/login", { body: { username, password } });
const actions = () => logs.map((l) => l.action);

test("TC-Sec-05: the account locks after the 3rd wrong password and answers 423", async () => {
  await call("POST", "/api/auth/register", { body: asha });

  const first = await login("asha_k", "wrong-1");
  const second = await login("asha_k", "wrong-2");
  assert.deepStrictEqual([first.status, second.status], [401, 401]);

  const third = await login("asha_k", "wrong-3");
  assert.strictEqual(third.status, 423);
  assert.ok(Number(third.headers.get("retry-after")) > 0);
  assert.ok(third.body.retryAfterSeconds > 0 && third.body.retryAfterSeconds <= 15 * 60);
  assert.match(third.body.message, /locked/i);
  assert.ok(+users[0].lockUntil > Date.now());
});

test("TC-Sec-05: while locked even the correct password is refused, other accounts are not affected", async () => {
  await call("POST", "/api/auth/register", { body: asha });
  await call("POST", "/api/auth/register", { body: { ...asha, email: "ravi@example.com", username: "ravi_s" } });
  for (let i = 0; i < 3; i++) await login("asha_k", "nope");

  const right = await login("asha_k", asha.password);
  assert.strictEqual(right.status, 423);
  assert.strictEqual(right.body.token, undefined);

  const other = await login("ravi_s", asha.password);
  assert.strictEqual(other.status, 200);
});

test("TC-Sec-05: the lock ends by itself, then login works and the counters reset", async () => {
  await call("POST", "/api/auth/register", { body: asha });
  for (let i = 0; i < 3; i++) await login("asha_k", "nope");
  users[0].lockUntil = new Date(Date.now() - 1000); // the 15 minutes have passed

  const ok = await login("asha_k", asha.password);
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(users[0].lockUntil, null);
  assert.strictEqual(users[0].failedLoginAttempts, 0);
});

test("TC-Sec-05: wrong passwords must be in a row: a good login in between starts the count again", async () => {
  await call("POST", "/api/auth/register", { body: asha });
  await login("asha_k", "nope");
  await login("asha_k", "nope");
  assert.strictEqual((await login("asha_k", asha.password)).status, 200);
  assert.strictEqual((await login("asha_k", "nope")).status, 401);
  assert.strictEqual((await login("asha_k", "nope")).status, 401); // 2 in a row again, not 3
  assert.strictEqual(users[0].lockUntil, null);
});

test("TC-Sec-05: an email that does not exist is never locked and never reveals anything", async () => {
  for (let i = 0; i < 6; i++) {
    const res = await login("nobody@example.com", "whatever-1");
    assert.strictEqual(res.status, 401);
  }
});

test("TC-Sec-05: authentication events are logged (register, failed, locked, blocked, success)", async () => {
  await call("POST", "/api/auth/register", { body: asha });
  await login("asha_k", "nope");
  await login("asha_k", "nope");
  await login("asha_k", "nope"); // locks
  await login("asha_k", asha.password); // blocked
  users[0].lockUntil = new Date(Date.now() - 1000);
  await login("asha_k", asha.password); // success
  await login("ghost", "nope-nope"); // unknown account

  assert.deepStrictEqual(actions(), [
    "register_success", "login_failed", "login_failed", "account_locked", "login_blocked", "login_success", "login_failed",
  ]);
  const failed = logs.filter((l) => l.action === "login_failed");
  assert.strictEqual(failed[0].detail.reason, "wrong_password");
  assert.strictEqual(failed[0].detail.attempts, 1);
  assert.strictEqual(failed[2].detail.reason, "unknown_account");
  assert.ok(logs.every((l) => l.category === "auth" && l.occurredAt instanceof Date && l.retainUntil > l.occurredAt));
  assert.strictEqual(String(logs.find((l) => l.action === "login_success").actor), String(users[0]._id));
});

test("TC-Sec-05 / TC-Sec-02: no password or token ever reaches the log", async () => {
  await call("POST", "/api/auth/register", { body: asha });
  const wrong = await login("asha_k", "my-secret-guess-9");
  const good = await login("asha_k", asha.password);
  assert.strictEqual(good.status, 200);
  const everything = JSON.stringify(logs);
  for (const secret of [asha.password, "my-secret-guess-9", good.body.token, users[0].password]) {
    assert.ok(!everything.includes(secret), `log must not contain ${secret.slice(0, 6)}...`);
  }
  assert.strictEqual(wrong.status, 401);
});

test("a password pasted into the username box is not written to the log", async () => {
  await login("my password with spaces 123", "x-x-x-x-x-x");
  assert.strictEqual(logs[0].actorLabel, "[not a valid username]");
});

test("EMS-SR-004 / SR-005: a refused role check (403) is logged with who and what", async () => {
  const token = jwt.sign({ id: "0".repeat(24), role: "Attendee" }, process.env.JWT_SECRET);
  const res = await call("GET", "/admin-only", { token });
  assert.strictEqual(res.status, 403);
  assert.strictEqual(logs.length, 1);
  assert.deepStrictEqual([logs[0].action, logs[0].outcome, logs[0].role], ["access_denied", "denied", "Attendee"]);
  assert.deepStrictEqual(logs[0].detail, { method: "GET", path: "/admin-only", needs: ["Admin"] });
});
