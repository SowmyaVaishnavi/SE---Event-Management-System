// Tests for EMS-F-001 register, F-002 login, F-003 RBAC and SR-002 bcrypt.
// The User model's queries are stubbed, but the real pre-save hook does the hashing. Run: npm test
process.env.JWT_SECRET = "test-secret";
process.env.BCRYPT_ROUNDS = "4";
const test = require("node:test");
const assert = require("node:assert");
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authRoutes = require("../routes/authRoutes");
const { requireAuth, requireRole } = require("../middleware/auth");
const { isBcryptHash } = require("../lib/passwords");

let users;
const q = (value) => ({ select: () => q(value), lean: () => q(value), then: (a, b) => Promise.resolve(value).then(a, b) });
const matches = (u, f) => (f.$or ? f.$or.some((g) => matches(u, g)) : Object.entries(f).every(([k, v]) => u[k] === v));

test.beforeEach(() => {
  users = [];
  User.findOne = (f) => q(users.find((u) => matches(u, f)) ?? null);
  User.findById = (id) => q(users.find((u) => String(u._id) === String(id)) ?? null);
  // Runs the real schema validation and pre-save hook, then keeps the document in memory.
  User.create = async (data) => {
    const doc = new User(data);
    await doc.validate();
    await User.schema.s.hooks.execPre("save", doc, []);
    users.push(doc);
    return doc;
  };
});

async function call(method, path, { body, token } = {}) {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.get("/organizer-only", requireAuth, requireRole("Organizer"), (req, res) => res.json({ ok: true }));
  app.get("/admin-only", requireAuth, requireRole("Admin"), (req, res) => res.json({ ok: true }));
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  try {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

const sign = (role) => jwt.sign({ id: "0".repeat(24), role }, process.env.JWT_SECRET);
const asha = { name: "Asha", email: "Asha@Example.com", username: "asha_k", password: "secret-pass-1", role: "Organizer" };

test("TC-Auth-01: sign up as Organizer, then log in right after", async () => {
  const reg = await call("POST", "/api/auth/register", { body: asha });
  assert.strictEqual(reg.status, 201);
  assert.strictEqual(reg.body.user.role, "Organizer");
  assert.strictEqual(reg.body.user.password, undefined);

  const login = await call("POST", "/api/auth/login", { body: { email: "asha@example.com", password: asha.password } });
  assert.strictEqual(login.status, 200);
  assert.strictEqual(jwt.verify(login.body.token, process.env.JWT_SECRET).role, "Organizer");
});

test("TC-Auth-01: role must be Attendee or Organizer, duplicates are rejected", async () => {
  assert.strictEqual((await call("POST", "/api/auth/register", { body: { ...asha, role: "Admin" } })).status, 400);
  assert.strictEqual((await call("POST", "/api/auth/register", { body: { ...asha, password: "short" } })).status, 400);
  assert.strictEqual((await call("POST", "/api/auth/register", { body: { ...asha, username: "a b" } })).status, 400);
  await call("POST", "/api/auth/register", { body: asha });
  const dupEmail = await call("POST", "/api/auth/register", { body: { ...asha, username: "other" } });
  assert.strictEqual(dupEmail.status, 409);
  const dupUser = await call("POST", "/api/auth/register", { body: { ...asha, email: "new@example.com" } });
  assert.deepStrictEqual([dupUser.status, dupUser.body.message], [409, "Username already taken"]);
});

test("TC-Auth-02: log in with username; wrong login shows an error", async () => {
  await call("POST", "/api/auth/register", { body: asha });
  assert.strictEqual((await call("POST", "/api/auth/login", { body: { username: "ASHA_K", password: asha.password } })).status, 200);

  const wrongPw = await call("POST", "/api/auth/login", { body: { username: "asha_k", password: "nope-nope" } });
  const noUser = await call("POST", "/api/auth/login", { body: { username: "ghost", password: "nope-nope" } });
  assert.strictEqual(wrongPw.status, 401);
  assert.strictEqual(noUser.status, 401);
  assert.strictEqual(wrongPw.body.message, noUser.body.message);
  assert.strictEqual((await call("POST", "/api/auth/login", { body: {} })).status, 400);
});

test("TC-Sec-02: the stored password is a bcrypt hash, never the plaintext", async () => {
  await call("POST", "/api/auth/register", { body: asha });
  const stored = users[0].password;
  assert.ok(isBcryptHash(stored));
  assert.notStrictEqual(stored, asha.password);
  assert.strictEqual(JSON.stringify(users[0]).includes(stored), false);
});

test("TC-Auth-03 / TC-Sec-04: a feature outside your role shows an error", async () => {
  const blocked = await call("GET", "/organizer-only", { token: sign("Attendee") });
  assert.strictEqual(blocked.status, 403);
  assert.match(blocked.body.message, /do not have access/);
  assert.strictEqual((await call("GET", "/organizer-only", { token: sign("Organizer") })).status, 200);
  assert.strictEqual((await call("GET", "/organizer-only", { token: sign("Admin") })).status, 200, "Admin builds on Organizer");
  assert.strictEqual((await call("GET", "/admin-only", { token: sign("Organizer") })).status, 403);
  assert.strictEqual((await call("GET", "/organizer-only")).status, 401);
  assert.strictEqual((await call("GET", "/organizer-only", { token: sign("Hacker") })).status, 401);
  const forged = jwt.sign({ id: "x", role: "Admin" }, "wrong-secret");
  assert.strictEqual((await call("GET", "/admin-only", { token: forged })).status, 401);
});

test("GET /api/auth/me returns the logged-in user", async () => {
  const reg = await call("POST", "/api/auth/register", { body: asha });
  const token = jwt.sign({ id: String(reg.body.user.id), role: "Organizer" }, process.env.JWT_SECRET);
  const me = await call("GET", "/api/auth/me", { token });
  assert.strictEqual(me.status, 200);
  assert.strictEqual(me.body.user.username, "asha_k");
});
