// EMS-NF-004: event and transaction logs. Runs one whole story (create event -> book -> pay -> check in -> refund ->
// cancel) against the real routes with an in-memory database, and checks that each step left a log row.
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
const eventRoutes = require("../routes/events");
const bookingRoutes = require("../routes/bookings");
const paymentRoutes = require("../routes/payments");
const audit = require("../lib/auditLog");
const { install } = require("./helpers/fakeDb");

const oid = (n) => String(n).padStart(24, "0");
const inDays = (d) => new Date(Date.now() + d * 864e5);
const organizer = { id: oid(21), role: "Organizer" };
const admin = { id: oid(30), role: "Admin" };
const asha = { id: oid(11), role: "Attendee" };
let db, logs;

test.beforeEach(() => {
  logs = [];
  audit.setWriter(async (doc) => { logs.push(doc); });
  db = {
    events: install(Event, []),
    bookings: install(Booking, []),
    payments: install(Payment, []),
    users: install(User, [{ _id: asha.id, name: "Asha", email: "asha@example.com", role: "Attendee" }]),
    notes: install(Notification, []),
  };
});
test.after(() => audit.setWriter(null));

async function call(method, path, { user, body } = {}) {
  const app = express();
  app.use(express.json());
  app.use("/api/events", eventRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api", bookingRoutes);
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  try {
    const headers = { "Content-Type": "application/json" };
    if (user) headers.Authorization = `Bearer ${jwt.sign(user, process.env.JWT_SECRET)}`;
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}
const actions = () => logs.map((l) => l.action);

test("TC-OPS-01: event, booking and payment actions each leave a log row", async () => {
  const created = await call("POST", "/events", {
    user: organizer,
    body: { title: "Music Night", description: "Live bands", category: "Cultural", capacity: 5, date: inDays(5).toISOString(), venue: "Open Air Theatre", price: 100 },
  });
  assert.strictEqual(created.status, 201);
  const eventId = created.body.eventId;

  const edited = await call("PUT", `/events/${eventId}`, { user: organizer, body: { venue: "Main Hall" } });
  assert.strictEqual(edited.status, 200);

  const booked = await call("POST", `/events/${eventId}/register`, { user: asha });
  assert.strictEqual(booked.body.status, "pending_payment");
  const paymentId = booked.body.payment.paymentId;
  const gw = await call("POST", `/payments/${paymentId}/sandbox-checkout`, { user: asha, body: { outcome: "success" } });
  const forged = await call("POST", `/payments/${paymentId}/confirm`, { user: asha, body: { paymentId: gw.body.paymentId, signature: "0".repeat(64) } });
  assert.strictEqual(forged.status, 400);
  const paid = await call("POST", `/payments/${paymentId}/confirm`, { user: asha, body: { paymentId: gw.body.paymentId, signature: gw.body.signature } });
  assert.strictEqual(paid.status, 200);

  const code = db.bookings[0].ticketCode;
  assert.strictEqual((await call("POST", "/checkin/scan", { user: organizer, body: { qrCode: code } })).status, 200);
  assert.strictEqual((await call("POST", "/checkin/scan", { user: organizer, body: { qrCode: code } })).status, 400);
  assert.strictEqual((await call("POST", "/checkin/scan", { user: organizer, body: { qrCode: "EMS-FAKE-FAKE-FAKE" } })).status, 400);

  const refunded = await call("POST", `/payments/${paymentId}/refund`, { user: admin, body: { reason: "duplicate" } });
  assert.strictEqual(refunded.status, 200);
  const cancelled = await call("POST", `/events/${eventId}/cancel`, { user: organizer, body: { reason: "rain" } });
  assert.strictEqual(cancelled.status, 200);

  assert.deepStrictEqual(actions(), [
    "event_created", "event_updated", "booking_held",
    "payment_verification_failed", "payment_paid",
    "checkin_success", "checkin_refused", "checkin_refused",
    "payment_refunded", "event_cancelled",
  ]);
  assert.deepStrictEqual(logs.filter((l) => l.action === "checkin_refused").map((l) => l.detail.reason), ["already_used", "unknown_ticket"]);
  assert.deepStrictEqual(logs.find((l) => l.action === "event_updated").detail.changed, ["venue"]);
  assert.strictEqual(logs.find((l) => l.action === "payment_paid").detail.amountPaise, 10000);
  assert.strictEqual(logs.find((l) => l.action === "event_created").actor, organizer.id);
  assert.strictEqual(logs.find((l) => l.action === "payment_refunded").actor, admin.id);
  assert.ok(logs.every((l) => ["event", "booking", "payment"].includes(l.category) && l.retainUntil - l.occurredAt >= 730 * 864e5));
});

test("free booking and attendee cancel are logged; ticket codes and card data never are", async () => {
  db.events.push(Object.assign(await Event.create({ title: "Free Talk", category: "Seminar", date: inDays(5), venue: "Hall", capacity: 10, price: 0, status: "published" })));
  const eventId = db.events[0]._id;

  const booked = await call("POST", `/events/${eventId}/register`, { user: asha });
  assert.strictEqual(booked.status, 201);
  const cancel = await call("POST", `/bookings/${booked.body.ticketId}/cancel`, { user: asha });
  assert.strictEqual(cancel.status, 200);
  assert.deepStrictEqual(actions(), ["booking_confirmed", "booking_cancelled"]);

  const text = JSON.stringify(logs);
  assert.ok(!text.includes(db.bookings[0].ticketCode), "the ticket code is a bearer credential: not logged");
  assert.ok(!/\b\d{13,19}\b/.test(text));
});

test("a refused request (400/403) that changes nothing does not create event rows", async () => {
  const bad = await call("POST", "/events", { user: asha, body: { title: "x" } }); // attendee: 403
  assert.strictEqual(bad.status, 403);
  assert.deepStrictEqual(actions(), ["access_denied"]);
});
