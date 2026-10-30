// Route-level tests for EMS-F-010/011/012/019. The Mongoose models are stubbed with
// an in-memory store, so no MongoDB is needed. Run: npm test
process.env.JWT_SECRET = "test-secret";
const test = require("node:test");
const assert = require("node:assert");
const express = require("express");
const jwt = require("jsonwebtoken");
const Event = require("../models/Event");
const Booking = require("../models/Booking");
const bookingRoutes = require("../routes/bookings");

const oid = (n) => String(n).padStart(24, "0");
const future = (d) => new Date(Date.now() + d * 864e5);
let events, bookings, seq;

// Query stand-in: awaitable, and tolerates .lean() / .sort() / .populate()
const q = (value) => ({ lean: () => q(value), sort: () => q(value), populate: () => q(value), then: (a, b) => Promise.resolve(value).then(a, b) });
const matches = (b, f) => Object.entries(f).every(([k, v]) => (v && v.$in ? v.$in.map(String).includes(String(b[k])) : String(b[k]) === String(v)));

function makeDoc(data) {
  const doc = { _id: oid(++seq), createdAt: new Date(), checkedInAt: null, cancelledAt: null, status: "confirmed", ticketCode: Booking.generateTicketCode(), ...data };
  doc.save = async () => doc;
  bookings.push(doc);
  return doc;
}

test.beforeEach(() => {
  seq = 100;
  events = [
    { _id: oid(1), title: "Tech Talk", category: "Technical", date: future(3), venue: "Hall", capacity: 2, status: "published" },
    { _id: oid(2), title: "Old Meetup", category: "Social", date: future(-2), capacity: 10, status: "published" },
    { _id: oid(3), title: "No capacity set", category: "Other", date: future(5) },
  ];
  bookings = [];
  Event.findById = (id) => q(events.find((e) => e._id === String(id)) ?? null);
  Event.find = (f) => q(events.filter((e) => matches(e, f)));
  Booking.findOne = (f) => q(bookings.find((b) => matches(b, f)) ?? null);
  Booking.findById = (id) => q(bookings.find((b) => b._id === String(id)) ?? null);
  Booking.find = (f) => q(bookings.filter((b) => matches(b, f)));
  Booking.countDocuments = async (f) => bookings.filter((b) => matches(b, f)).length;
  Booking.create = async (data) => makeDoc(data);
});

async function call(method, path, { user, body } = {}) {
  const app = express();
  app.use(express.json());
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
const alice = { id: oid(11), role: "Attendee" };
const bob = { id: oid(12), role: "Attendee" };
const org = { id: oid(21), role: "Organizer" };

test("book: needs login and the Attendee role", async () => {
  assert.strictEqual((await call("POST", `/events/${oid(1)}/register`)).status, 401);
  assert.strictEqual((await call("POST", `/events/${oid(1)}/register`, { user: org })).status, 403);
});

test("book: confirms and returns a ticket code", async () => {
  const r = await call("POST", `/events/${oid(1)}/register`, { user: alice });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.body.status, "confirmed");
  assert.strictEqual(r.body.qrCode, r.body.ticket.ticketCode);
  assert.ok(r.body.ticketId);
  assert.match(r.body.ticket.ticketCode, /^EMS-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
});

test("book: rejects double booking, full events, past events, unknown events", async () => {
  assert.strictEqual((await call("POST", `/events/${oid(1)}/register`, { user: alice })).status, 201);
  assert.strictEqual((await call("POST", `/events/${oid(1)}/register`, { user: alice })).status, 409);
  assert.strictEqual((await call("POST", `/events/${oid(1)}/register`, { user: bob })).status, 201);
  const full = await call("POST", `/events/${oid(1)}/register`, { user: { id: oid(13), role: "Attendee" } });
  assert.strictEqual(full.status, 400); // SAD 4.3: 400 event full
  assert.match(full.body.message, /full/i);
  assert.strictEqual((await call("POST", `/events/${oid(2)}/register`, { user: alice })).status, 409);
  assert.strictEqual((await call("POST", `/events/${oid(99)}/register`, { user: alice })).status, 404);
  assert.strictEqual((await call("POST", `/events/not-an-id/register`, { user: alice })).status, 404);
});

test("book: event with no capacity set is not limited", async () => {
  assert.strictEqual((await call("POST", `/events/${oid(3)}/register`, { user: alice })).status, 201);
});

test("my tickets lists only my own bookings", async () => {
  await call("POST", `/events/${oid(1)}/register`, { user: alice });
  await call("POST", `/events/${oid(1)}/register`, { user: bob });
  const r = await call("GET", "/bookings/me", { user: alice });
  assert.strictEqual(r.body.tickets.length, 1);
  assert.strictEqual(r.body.tickets[0].event.title, "Tech Talk");
});

test("cancel: owner can cancel and the seat is released", async () => {
  await call("POST", `/events/${oid(1)}/register`, { user: alice });
  await call("POST", `/events/${oid(1)}/register`, { user: bob });
  const id = bookings[0]._id;
  assert.strictEqual((await call("POST", `/bookings/${id}/cancel`, { user: bob })).status, 404); // not bob's
  assert.strictEqual((await call("POST", `/bookings/${id}/cancel`, { user: alice })).status, 200);
  assert.strictEqual((await call("POST", `/bookings/${id}/cancel`, { user: alice })).status, 409); // already cancelled
  assert.strictEqual((await call("POST", `/events/${oid(1)}/register`, { user: { id: oid(13), role: "Attendee" } })).status, 201);
});

test("check-in: organizer only, valid once, rejects cancelled and unknown codes", async () => {
  await call("POST", `/events/${oid(1)}/register`, { user: alice });
  const code = bookings[0].ticketCode;
  assert.strictEqual((await call("POST", "/checkin/scan", { user: alice, body: { qrCode: code } })).status, 403);
  assert.strictEqual((await call("POST", "/checkin/scan", { user: org, body: {} })).status, 400);
  assert.strictEqual((await call("POST", "/checkin/scan", { user: org, body: { qrCode: "EMS-XXXX-XXXX-XXXX" } })).status, 400);
  assert.strictEqual((await call("POST", "/checkin/scan", { user: org, body: { qrCode: code.toLowerCase() } })).status, 200);
  const again = await call("POST", "/checkin/scan", { user: org, body: { qrCode: code } });
  assert.strictEqual(again.status, 400);
  assert.match(again.body.message, /already/i);
  // cancelled ticket cannot check in; checked-in ticket cannot be cancelled
  assert.strictEqual((await call("POST", `/bookings/${bookings[0]._id}/cancel`, { user: alice })).status, 409);
});

test("check-in: a cancelled ticket is refused", async () => {
  await call("POST", `/events/${oid(1)}/register`, { user: alice });
  await call("POST", `/bookings/${bookings[0]._id}/cancel`, { user: alice });
  const r = await call("POST", "/checkin/scan", { user: org, body: { qrCode: bookings[0].ticketCode } });
  assert.strictEqual(r.status, 400);
  assert.match(r.body.message, /cancelled/i);
});
