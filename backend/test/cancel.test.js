// Tests for EMS-F-006 cancel event + alerts, and the notification service. Models are stubbed. Run: npm test
process.env.JWT_SECRET = "test-secret";
const test = require("node:test");
const assert = require("node:assert");
const express = require("express");
const jwt = require("jsonwebtoken");
const Event = require("../models/Event");
const Booking = require("../models/Booking");
const User = require("../models/User");
const Notification = require("../models/Notification");
const Payment = require("../models/Payment");
const eventRoutes = require("../routes/events");
const notificationRoutes = require("../routes/notifications");
const { sendEmail, notify } = require("../lib/notify");

const oid = (n) => String(n).padStart(24, "0");
const inDays = (d) => new Date(Date.now() + d * 864e5);
const q = (value) => ({ lean: () => q(value), sort: () => q(value), limit: () => q(value), then: (a, b) => Promise.resolve(value).then(a, b) });

const organizer = { id: oid(21), role: "Organizer" };
const attendee = { id: oid(11), role: "Attendee" };
let event, bookings, notes;

function makeEvent(over = {}) {
  const doc = { _id: oid(7), title: "Hack Night", status: "published", date: inDays(3), organizer: organizer.id, price: 0, ...over };
  doc.save = async () => doc;
  return doc;
}

test.beforeEach(() => {
  event = makeEvent();
  bookings = [
    { _id: oid(101), user: oid(11), event: oid(7), status: "confirmed" },
    { _id: oid(102), user: oid(12), event: oid(7), status: "confirmed" },
    { _id: oid(103), user: oid(13), event: oid(7), status: "cancelled" },
  ];
  notes = [];
  Event.findById = () => event;
  Booking.find = (f) => q(bookings.filter((b) => String(b.event) === String(f.event) && b.status !== "cancelled"));
  Booking.updateMany = async (f, u) => {
    for (const b of bookings) if (String(b.event) === String(f.event) && b.status !== "cancelled") Object.assign(b, u.$set);
    return {};
  };
  Booking.aggregate = async () => [];
  Payment.updateMany = async () => ({});
  Notification.insertMany = async (docs) => docs.map((d, i) => { const n = { _id: oid(500 + notes.length + i), ...d, createdAt: new Date(), readAt: null }; return n; }).map((n) => (notes.push(n), n));
  Notification.updateOne = async () => ({ matchedCount: 1 });
  Notification.find = (f) => q(notes.filter((n) => String(n.user) === String(f.user)));
  User.find = () => q([]);
});

async function call(method, path, { user, body } = {}) {
  const app = express();
  app.use(express.json());
  app.use("/api/events", eventRoutes);
  app.use("/api/notifications", notificationRoutes);
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

test("TC-Event-03: cancelling marks the event cancelled and alerts everyone booked", async () => {
  const res = await call("POST", `/events/${oid(7)}/cancel`, { user: organizer, body: { reason: "Venue unavailable" } });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, "cancelled");
  assert.strictEqual(res.body.notified, 2);
  assert.strictEqual(event.status, "cancelled");
  assert.strictEqual(event.cancelReason, "Venue unavailable");
  assert.deepStrictEqual(bookings.map((b) => b.status), ["cancelled", "cancelled", "cancelled"]);
  assert.strictEqual(bookings[0].cancelReason, "event_cancelled");
  assert.deepStrictEqual(notes.map((n) => n.user).sort(), [oid(11), oid(12)]);
  assert.strictEqual(notes[0].type, "event_cancelled");
  assert.match(notes[0].message, /Venue unavailable/);

  // The attendee sees the alert under GET /api/notifications/me
  const mine = await call("GET", "/notifications/me", { user: attendee });
  assert.strictEqual(mine.status, 200);
  assert.strictEqual(mine.body.unread, 1);
  assert.match(mine.body.notifications[0].title, /Cancelled: Hack Night/);
});

test("only the event's organizer or an Admin can cancel", async () => {
  assert.strictEqual((await call("POST", `/events/${oid(7)}/cancel`, { user: attendee })).status, 403);
  assert.strictEqual((await call("POST", `/events/${oid(7)}/cancel`, { user: { id: oid(22), role: "Organizer" } })).status, 403);
  assert.strictEqual((await call("POST", `/events/${oid(7)}/cancel`)).status, 401);
  assert.strictEqual((await call("POST", `/events/${oid(7)}/cancel`, { user: { id: oid(30), role: "Admin" } })).status, 200);
});

test("cannot cancel twice, a past event, an unknown event, or with a bad reason", async () => {
  event = makeEvent({ status: "cancelled" });
  assert.strictEqual((await call("POST", `/events/${oid(7)}/cancel`, { user: organizer })).status, 409);
  event = makeEvent({ date: inDays(-1) });
  assert.strictEqual((await call("POST", `/events/${oid(7)}/cancel`, { user: organizer })).status, 409);
  event = makeEvent();
  assert.strictEqual((await call("POST", `/events/${oid(7)}/cancel`, { user: organizer, body: { reason: "x".repeat(501) } })).status, 400);
  Event.findById = () => null;
  assert.strictEqual((await call("POST", `/events/${oid(8)}/cancel`, { user: organizer })).status, 404);
});

test("an event with no bookings is cancelled with nobody to alert", async () => {
  bookings = [];
  const res = await call("POST", `/events/${oid(7)}/cancel`, { user: organizer });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.notified, 0);
});

test("sendEmail retries 3 times and reports failure; skipped without a webhook", async () => {
  let calls = 0;
  const failing = async () => { calls++; return { ok: false, status: 503 }; };
  const result = await sendEmail("a@b.c", "s", "t", { fetchImpl: failing, url: "https://mail.example/send" });
  assert.deepStrictEqual([result.status, result.attempts, calls], ["failed", 3, 3]);
  let second = 0;
  const flaky = async () => (++second < 2 ? { ok: false, status: 500 } : { ok: true, status: 200 });
  assert.deepStrictEqual(await sendEmail("a@b.c", "s", "t", { fetchImpl: flaky, url: "https://mail.example/send" }), { status: "sent", attempts: 2 });
  assert.strictEqual((await sendEmail("a@b.c", "s", "t", { url: "" })).status, "skipped");
});

test("notify sends an email per alert when a webhook is set, and never throws", async () => {
  User.find = () => q([{ _id: oid(11), email: "asha@example.com" }]);
  const sent = [];
  const fetchImpl = async (url, opts) => { sent.push(JSON.parse(opts.body)); return { ok: true, status: 200 }; };
  const n = await notify([oid(11), oid(11)], { type: "event_cancelled", title: "T", message: "M" }, { fetchImpl, url: "https://mail.example/send", waitForEmail: true });
  assert.strictEqual(n, 1, "duplicate users get one alert");
  assert.deepStrictEqual(sent, [{ to: "asha@example.com", subject: "T", text: "M" }]);

  Notification.insertMany = async () => { throw new Error("db down"); };
  assert.strictEqual(await notify([oid(11)], { type: "event_cancelled", title: "T", message: "M" }), 0);
});
