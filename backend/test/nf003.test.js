// TC-Sec-01 / EMS-NF-003 (issue #26): sensitive data only over HTTPS, passwords never stored or exposed in plaintext.
// Complements tls.test.js (TLS versions, HSTS) and auth.test.js (bcrypt on sign-up) with the "no leaks" checks:
// responses, logs, audit trail and error messages. In-memory stand-ins, no MongoDB needed. Run: npm test
process.env.JWT_SECRET = "test-secret";
process.env.BCRYPT_ROUNDS = "4";
const test = require("node:test");
const assert = require("node:assert");
const util = require("node:util");
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const audit = require("../lib/auditLog");
const authRoutes = require("../routes/authRoutes");
const { isBcryptHash, hashPassword, verifyPassword } = require("../lib/passwords");
const { httpsOnly } = require("../lib/tls");
const { errorHandler } = require("../lib/errorHandler");

const BCRYPT_ANYWHERE = /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{20,}/;
const PASSWORD = "Sup3r-Secret-Pass!";
const asha = { name: "Asha", email: "asha@example.com", username: "asha_k", password: PASSWORD, role: "Organizer" };

let users;
let auditRows;
let userLookups;
const q = (value) => ({ select: () => q(value), lean: () => q(value), then: (a, b) => Promise.resolve(value).then(a, b) });
const matches = (u, f) => (f.$or ? f.$or.some((g) => matches(u, g)) : Object.entries(f).every(([k, v]) => u[k] === v));

test.beforeEach(() => {
  users = [];
  userLookups = 0;
  auditRows = [];
  audit.setWriter(async (doc) => { auditRows.push(doc); });
  User.findOne = (f) => { userLookups += 1; return q(users.find((u) => matches(u, f)) ?? null); };
  User.findById = (id) => q(users.find((u) => String(u._id) === String(id)) ?? null);
  const apply = (f, u) => {
    const doc = users.find((x) => String(x._id) === String(f._id));
    if (doc) {
      for (const [k, v] of Object.entries(u.$inc || {})) doc[k] = (doc[k] || 0) + v;
      Object.assign(doc, u.$set || {});
    }
    return doc ?? null;
  };
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

test.afterEach(() => audit.setWriter(null));

function makeApp(middleware = []) {
  const app = express();
  for (const m of middleware) app.use(m);
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use(errorHandler); // same position as in server.js
  return app;
}

async function send(app, method, path, { body, token, headers: extra = {}, raw } = {}) {
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  try {
    const headers = { "Content-Type": "application/json", ...extra };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers, redirect: "manual", body: raw ?? (body ? JSON.stringify(body) : undefined),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, text, body: json, headers: res.headers };
  } finally {
    server.close();
  }
}

const call = (method, path, opts) => send(makeApp(), method, `/api/auth${path}`, opts);
const hasSecret = (text) => text.includes(PASSWORD) || BCRYPT_ANYWHERE.test(text);

test("TC-Sec-01 (NF-003): sign-up, login and /me never return the password or its hash", async () => {
  const reg = await call("POST", "/register", { body: asha });
  assert.strictEqual(reg.status, 201);
  const login = await call("POST", "/login", { body: { email: asha.email, password: PASSWORD } });
  assert.strictEqual(login.status, 200);
  const me = await call("GET", "/me", { token: login.body.token });
  assert.strictEqual(me.status, 200);

  for (const res of [reg, login, me]) {
    assert.strictEqual(hasSecret(res.text), false, "response must not contain the password or a bcrypt hash");
    assert.strictEqual(res.body.user.password, undefined);
    assert.strictEqual(res.body.user.failedLoginAttempts, undefined);
    assert.strictEqual(res.body.user.lockUntil, undefined);
  }
  // The login token carries only id and role, no password data.
  const claims = jwt.verify(login.body.token, process.env.JWT_SECRET);
  assert.deepStrictEqual(Object.keys(claims).sort(), ["exp", "iat", "id", "role"]);
});

test("TC-Sec-01 (NF-003): stored passwords are bcrypt hashes, salted, and the schema never selects them by default", async () => {
  await call("POST", "/register", { body: asha });
  await call("POST", "/register", { body: { ...asha, email: "ravi@example.com", username: "ravi_s" } }); // same password
  assert.strictEqual(users.length, 2);
  assert.ok(users.every((u) => isBcryptHash(u.password)), "every stored password is a bcrypt hash");
  assert.notStrictEqual(users[0].password, users[1].password, "same password must give different hashes (salt)");
  assert.ok(users.every((u) => u.password !== PASSWORD));
  assert.strictEqual(JSON.stringify(users).includes(PASSWORD), false, "plaintext must not appear anywhere in the stored users");
  assert.strictEqual(User.schema.path("password").options.select, false, "password is excluded from queries by default");
  // Both hashes still verify the right password and reject a wrong one.
  assert.strictEqual(await verifyPassword(PASSWORD, users[0].password), true);
  assert.strictEqual(await verifyPassword("wrong-password", users[0].password), false);
});

test("TC-Sec-01 (NF-003): no save path stores plaintext, including a later password change", async () => {
  const user = new User({ ...asha });
  await User.schema.s.hooks.execPre("save", user, []);
  const first = user.password;
  assert.ok(isBcryptHash(first));

  user.password = "Another-Pass-456";
  await User.schema.s.hooks.execPre("save", user, []);
  assert.ok(isBcryptHash(user.password));
  assert.notStrictEqual(user.password, first);
  assert.notStrictEqual(user.password, "Another-Pass-456");

  // An already-hashed value is not hashed twice (no double hashing on unrelated saves).
  const hash = await hashPassword("x-y-z-12345");
  const again = new User({ ...asha, password: hash });
  await User.schema.s.hooks.execPre("save", again, []);
  assert.strictEqual(again.password, hash);
});

test("TC-Sec-01 (NF-003): passwords never reach the audit trail or the server logs", async () => {
  const captured = [];
  // node --test sets NODE_ENV=test, which silences Express's own error logging. Run this one like a developer's
  // machine (NODE_ENV unset) so a leak through Express's default error handler would show up here.
  const previousEnv = process.env.NODE_ENV;
  delete process.env.NODE_ENV;
  const real = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  for (const k of Object.keys(real)) console[k] = (...args) => captured.push(args.map((a) => (typeof a === "string" ? a : util.inspect(a, { depth: 4 }))).join(" "));
  try {
    await call("POST", "/register", { body: asha });
    await call("POST", "/login", { body: { email: asha.email, password: PASSWORD } });
    await call("POST", "/login", { body: { email: asha.email, password: "wrong-" + PASSWORD } });
    await call("POST", "/login", { body: { username: PASSWORD, password: "wrong-" + PASSWORD } }); // password pasted in the name box
    await call("POST", "/login", { body: { email: "ghost@example.com", password: PASSWORD } });
    // A body that is not valid JSON makes Express fail while parsing; the raw body must not be logged.
    await call("POST", "/login", { raw: `{"email":"${asha.email}","password":"${PASSWORD}` });
    await call("POST", "/login", { body: { email: asha.email, password: PASSWORD.repeat(2000) } });
    await new Promise((r) => setTimeout(r, 30)); // audit.record is fire-and-forget
  } finally {
    Object.assign(console, real);
    if (previousEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnv;
  }
  assert.ok(auditRows.length >= 4, "auth events are recorded (register, login ok, failures)");
  const everything = JSON.stringify(auditRows) + captured.join("\n");
  assert.strictEqual(everything.includes(PASSWORD), false, "plaintext password found in logs");
  assert.strictEqual(everything.includes("wrong-" + PASSWORD), false);
  assert.strictEqual(BCRYPT_ANYWHERE.test(everything), false, "password hash found in logs");
});

test("TC-Sec-01 (NF-003): error responses never echo the password or reveal which part was wrong", async () => {
  await call("POST", "/register", { body: asha });
  const attempts = [
    { body: { email: asha.email, password: "wrong-" + PASSWORD } },
    { body: { email: "ghost@example.com", password: PASSWORD } },
    { body: { email: asha.email, password: { $gt: "" } } }, // NoSQL-injection style value
    { body: { email: { $ne: null }, password: PASSWORD } },
    { raw: `{"email":"${asha.email}","password":"${PASSWORD}` }, // malformed JSON
    { body: { email: asha.email, password: PASSWORD.repeat(2000) } }, // oversized body
    { body: {} },
  ];
  for (const attempt of attempts) {
    const res = await call("POST", "/login", attempt);
    assert.ok(res.status >= 400 && res.status < 500, `bad login should be a 4xx, got ${res.status}`);
    assert.strictEqual(res.text.includes(PASSWORD), false, "error response echoed the password");
    assert.strictEqual(/at .*\.js:\d+|node_modules|MongoServerError|CastError/i.test(res.text), false, "no stack trace or database error");
  }
  const wrongPw = await call("POST", "/login", { body: { email: asha.email, password: "nope-nope-1" } });
  const noUser = await call("POST", "/login", { body: { email: "ghost@example.com", password: "nope-nope-1" } });
  assert.strictEqual(wrongPw.body.message, noUser.body.message);
});

test("TC-Sec-01 (NF-003): with REQUIRE_HTTPS, credentials sent over plain HTTP are refused before they are read", async () => {
  const app = makeApp([httpsOnly({ requireHttps: true })]);

  const post = await send(app, "POST", "/api/auth/login", { body: { email: asha.email, password: PASSWORD } });
  assert.strictEqual(post.status, 403);
  assert.match(post.body.message, /HTTPS is required/);
  const register = await send(app, "POST", "/api/auth/register", { body: asha });
  assert.strictEqual(register.status, 403);
  assert.strictEqual(userLookups, 0, "the login handler must not run over plain HTTP");
  assert.strictEqual(users.length, 0, "no account is created over plain HTTP");

  const get = await send(app, "GET", "/api/auth/me");
  assert.strictEqual(get.status, 308);
  assert.match(get.headers.get("location"), /^https:\/\/[^/]+\/api\/auth\/me$/, "GET is redirected to the https:// address");
  assert.strictEqual(get.headers.get("strict-transport-security"), null, "HSTS is only sent on HTTPS responses");
});

test("TC-Sec-01 (NF-003): behind a TLS proxy the same request is accepted and HSTS is sent", async () => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(httpsOnly({ requireHttps: true }));
  app.use(express.json());
  app.use("/api/auth", authRoutes);

  const res = await send(app, "POST", "/api/auth/register", { body: asha, headers: { "X-Forwarded-Proto": "https" } });
  assert.strictEqual(res.status, 201);
  assert.match(res.headers.get("strict-transport-security"), /max-age=31536000/);
  assert.strictEqual(hasSecret(res.text), false);
});
