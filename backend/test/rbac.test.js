// TC-Sec-04 / EMS-SR-004 (issue #32): role-based access control on every role-protected endpoint.
// Mounts the REAL routers (events, bookings, payments, audit-logs, health) with in-memory stand-ins for
// the database, then checks the role x endpoint matrix from docs/Security_Validation_Report.md.
// Run: npm test
process.env.JWT_SECRET = "test-secret";
delete process.env.RAZORPAY_KEY_ID;
delete process.env.RAZORPAY_KEY_SECRET;
delete process.env.NOTIFY_WEBHOOK_URL;
const test = require("node:test");
const assert = require("node:assert");
const express = require("express");
const jwt = require("jsonwebtoken");
const Event = require("../models/Event");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const User = require("../models/User");
const Notification = require("../models/Notification");
const audit = require("../lib/auditLog");
const eventRoutes = require("../routes/events");
const bookingRoutes = require("../routes/bookings");
const paymentRoutes = require("../routes/payments");
const auditLogRoutes = require("../routes/auditLogs");
const healthRoutes = require("../routes/health");
const { install } = require("./helpers/fakeDb");

const oid = (n) => String(n).padStart(24, "0");
const inDays = (d) => new Date(Date.now() + d * 864e5);

const attendee = { id: oid(11), role: "Attendee" };
const attendee2 = { id: oid(12), role: "Attendee" };
const organizer = { id: oid(21), role: "Organizer" }; // owns EVT-1
const organizer2 = { id: oid(22), role: "Organizer" }; // owns EVT-2
const admin = { id: oid(30), role: "Admin" };
const EVT1 = oid(1);
const EVT2 = oid(2);
const PAY1 = oid(60); // belongs to attendee

let db;
let auditRows;

test.beforeEach(() => {
  db = {
    events: install(Event, [
      { _id: EVT1, title: "Tech Talk", category: "Technical", date: inDays(5), venue: "Hall", capacity: 10, price: 0, status: "published", organizer: organizer.id },
      { _id: EVT2, title: "Music Night", category: "Cultural", date: inDays(5), venue: "Lawn", capacity: 10, price: 0, status: "published", organizer: organizer2.id },
    ]),
    bookings: install(Booking, []),
    payments: install(Payment, [
      { _id: PAY1, user: attendee.id, event: EVT1, booking: oid(70), amount: 100, status: "paid", provider: "sandbox", providerOrderId: "order_x", providerPaymentId: "pay_x" },
    ]),
    users: install(User, [{ _id: attendee.id, name: "Asha", email: "asha@example.com", role: "Attendee" }]),
    notes: install(Notification, []),
  };
  // Capture the audit trail instead of writing to MongoDB.
  auditRows = [];
  audit.setWriter(async (doc) => { auditRows.push(doc); });
});

test.afterEach(() => audit.setWriter(null));

async function call(method, path, { user, token, body } = {}) {
  const app = express();
  app.use(express.json());
  app.use("/api/health", healthRoutes);
  app.use("/api/events", eventRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/audit-logs", auditLogRoutes);
  app.use("/api", bookingRoutes);
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  try {
    const headers = { "Content-Type": "application/json" };
    const bearer = token ?? (user ? jwt.sign(user, process.env.JWT_SECRET) : null);
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let json = null;
    try { json = await res.json(); } catch { /* empty body */ }
    return { status: res.status, body: json };
  } finally {
    server.close();
  }
}

const newEvent = () => ({ title: "Hackathon", description: "24h build", category: "technical", capacity: 50, date: inDays(10).toISOString(), venue: "Lab 3", price: 0 });

// Every endpoint that is limited to some roles. `denied` lists the roles that must get 403.
const PROTECTED = [
  { name: "create event", method: "POST", path: "/events", body: newEvent, denied: [attendee] },
  { name: "list my events", method: "GET", path: "/events/mine", denied: [attendee] },
  { name: "edit event", method: "PUT", path: `/events/${EVT1}`, body: () => ({ title: "Hacked" }), denied: [attendee, organizer2] },
  { name: "cancel event", method: "POST", path: `/events/${EVT1}/cancel`, denied: [attendee, organizer2] },
  { name: "check-in scan", method: "POST", path: "/checkin/scan", body: () => ({ qrCode: "ABC123" }), denied: [attendee] },
  { name: "book a spot (Attendee only)", method: "POST", path: `/events/${EVT1}/register`, denied: [organizer, admin] },
  { name: "admin: list payments", method: "GET", path: "/payments", denied: [attendee, organizer] },
  { name: "admin: refund", method: "POST", path: `/payments/${PAY1}/refund`, body: () => ({}), denied: [attendee, organizer] },
  { name: "admin: audit log", method: "GET", path: "/audit-logs", denied: [attendee, organizer] },
  { name: "admin: audit log status", method: "GET", path: "/audit-logs/status", denied: [attendee, organizer] },
  { name: "admin: response-time metrics", method: "GET", path: "/health/metrics", denied: [attendee, organizer] },
];

for (const ep of PROTECTED) {
  test(`TC-Sec-04: ${ep.name} - refused (403) for ${ep.denied.map((u) => u === organizer2 ? "other Organizer" : u.role).join(", ")}`, async () => {
    for (const user of ep.denied) {
      const res = await call(ep.method, ep.path, { user, body: ep.body?.() });
      assert.strictEqual(res.status, 403, `${user === organizer2 ? "other Organizer" : user.role} should get 403 on ${ep.method} ${ep.path}, got ${res.status}`);
    }
  });

  test(`TC-Sec-04: ${ep.name} - refused (401) with no token`, async () => {
    const res = await call(ep.method, ep.path, { body: ep.body?.() });
    assert.strictEqual(res.status, 401);
  });
}

test("TC-Sec-04: a refused action changes nothing (create, edit, cancel, refund)", async () => {
  await call("POST", "/events", { user: attendee, body: newEvent() });
  assert.strictEqual(db.events.length, 2, "attendee must not create an event");

  await call("PUT", `/events/${EVT1}`, { user: attendee, body: { title: "Hacked" } });
  await call("PUT", `/events/${EVT1}`, { user: organizer2, body: { title: "Hacked" } });
  assert.strictEqual(db.events.find((e) => e._id === EVT1).title, "Tech Talk");

  await call("POST", `/events/${EVT1}/cancel`, { user: attendee });
  await call("POST", `/events/${EVT1}/cancel`, { user: organizer2 });
  assert.strictEqual(db.events.find((e) => e._id === EVT1).status, "published");
  assert.strictEqual(db.notes.length, 0, "no cancellation alerts sent");

  await call("POST", `/payments/${PAY1}/refund`, { user: attendee, body: {} });
  await call("POST", `/payments/${PAY1}/refund`, { user: organizer, body: {} });
  assert.strictEqual(db.payments[0].status, "paid");
});

test("TC-Sec-04: Organizer can use the Organizer functions on their own event", async () => {
  assert.strictEqual((await call("POST", "/events", { user: organizer, body: newEvent() })).status, 201);
  assert.strictEqual((await call("GET", "/events/mine", { user: organizer })).status, 200);
  assert.strictEqual((await call("PUT", `/events/${EVT1}`, { user: organizer, body: { title: "New title" } })).status, 200);
  assert.strictEqual((await call("POST", `/events/${EVT1}/cancel`, { user: organizer })).status, 200);
  // Valid role, unknown ticket: reaches the handler (400), is not blocked (403).
  assert.strictEqual((await call("POST", "/checkin/scan", { user: organizer, body: { qrCode: "NOPE00" } })).status, 400);
});

test("TC-Sec-04: Admin inherits Organizer rights on any event and alone has the Admin functions", async () => {
  assert.strictEqual((await call("POST", "/events", { user: admin, body: newEvent() })).status, 201);
  assert.strictEqual((await call("PUT", `/events/${EVT2}`, { user: admin, body: { title: "Admin edit" } })).status, 200);
  assert.strictEqual((await call("POST", `/events/${EVT2}/cancel`, { user: admin })).status, 200);
  assert.strictEqual((await call("POST", "/checkin/scan", { user: admin, body: { qrCode: "NOPE00" } })).status, 400);
  assert.strictEqual((await call("GET", "/payments", { user: admin })).status, 200);
  assert.strictEqual((await call("GET", "/health/metrics", { user: admin })).status, 200);

  const realSearch = audit.search;
  const realStatus = audit.status;
  audit.search = async () => ({ logs: [], nextBefore: null });
  audit.status = async () => ({ recent: 0, archived: 0 });
  try {
    assert.strictEqual((await call("GET", "/audit-logs", { user: admin })).status, 200);
    assert.strictEqual((await call("GET", "/audit-logs/status", { user: admin })).status, 200);
  } finally {
    audit.search = realSearch;
    audit.status = realStatus;
  }

  // Refund is Admin-only: with an Admin token the request reaches the handler (not 401/403).
  const refund = await call("POST", `/payments/${oid(99)}/refund`, { user: admin, body: {} });
  assert.ok(![401, 403].includes(refund.status), `Admin refund should reach the handler, got ${refund.status}`);
});

test("TC-Sec-04: an Attendee can book, and cannot use someone else's payment", async () => {
  const book = await call("POST", `/events/${EVT1}/register`, { user: attendee });
  assert.ok(![401, 403].includes(book.status), `Attendee booking should reach the handler, got ${book.status}`);

  assert.strictEqual((await call("GET", `/payments/${PAY1}/receipt`, { user: attendee })).status, 200);
  // Same 404 as "does not exist", so ids cannot be probed.
  assert.strictEqual((await call("GET", `/payments/${PAY1}/receipt`, { user: attendee2 })).status, 404);
  assert.strictEqual((await call("GET", `/payments/${PAY1}/receipt`, { user: organizer })).status, 404);
});

test("TC-Sec-04: the role comes from the signed token only, never from the request body", async () => {
  const res = await call("POST", "/events", { user: attendee, body: { ...newEvent(), role: "Admin", user: { role: "Admin" } } });
  assert.strictEqual(res.status, 403);
});

test("TC-Sec-04: forged, tampered, expired and malformed tokens are refused (401)", async () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const algNone = `${b64({ alg: "none", typ: "JWT" })}.${b64({ id: oid(30), role: "Admin" })}.`;
  const wrongSecret = jwt.sign({ id: oid(30), role: "Admin" }, "not-the-secret");
  const valid = jwt.sign(attendee, process.env.JWT_SECRET);
  const [h, , s] = valid.split(".");
  const payloadSwap = `${h}.${b64({ id: attendee.id, role: "Admin" })}.${s}`; // role edited, signature kept
  const expired = jwt.sign({ ...admin, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
  const unknownRole = jwt.sign({ id: oid(30), role: "SuperAdmin" }, process.env.JWT_SECRET);
  const noId = jwt.sign({ role: "Admin" }, process.env.JWT_SECRET);
  const hs512 = jwt.sign(admin, process.env.JWT_SECRET, { algorithm: "HS512" });

  const cases = { "alg none": algNone, "wrong secret": wrongSecret, "payload swapped": payloadSwap, expired, "unknown role": unknownRole, "no user id": noId, "HS512": hs512, garbage: "abc.def.ghi" };
  for (const [name, token] of Object.entries(cases)) {
    assert.strictEqual((await call("GET", "/payments", { token })).status, 401, `${name} must be refused`);
  }
  // Wrong scheme
  const app = express();
  app.use("/api/payments", paymentRoutes);
  const server = await new Promise((r) => { const sv = app.listen(0, () => r(sv)); });
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/payments`, { headers: { Authorization: `Basic ${jwt.sign(admin, process.env.JWT_SECRET)}` } });
    assert.strictEqual(res.status, 401);
  } finally {
    server.close();
  }
});

test("TC-Sec-04: every refused action is written to the audit log (user, role, path) with no secrets", async () => {
  const token = jwt.sign(attendee, process.env.JWT_SECRET);
  await call("POST", "/events", { token, body: newEvent() });
  await call("GET", "/payments", { token });
  await new Promise((r) => setTimeout(r, 30)); // record() is fire-and-forget

  const denied = auditRows.filter((r) => r.action === "access_denied");
  assert.strictEqual(denied.length, 2);
  for (const row of denied) {
    assert.strictEqual(row.category, "auth");
    assert.strictEqual(row.outcome, "denied");
    assert.strictEqual(row.role, "Attendee");
    assert.strictEqual(String(row.actor), attendee.id);
    assert.ok(row.detail.path.startsWith("/api/"));
  }
  assert.deepStrictEqual(denied.map((r) => r.detail.method), ["POST", "GET"]);
  assert.strictEqual(JSON.stringify(auditRows).includes(token), false, "the token must never be logged");
});
