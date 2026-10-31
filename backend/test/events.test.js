// Route tests for EMS-F-004 / F-007 (create) and the GET /api/events contract (F-008 / F-009).
// Models are stubbed, so no MongoDB is needed. Run: npm test
process.env.JWT_SECRET = "test-secret";
const test = require("node:test");
const assert = require("node:assert");
const express = require("express");
const jwt = require("jsonwebtoken");
const Event = require("../models/Event");
const Booking = require("../models/Booking");
const eventRoutes = require("../routes/events");
const { parseEventFields, publishProblems } = require("../lib/eventFields");

const oid = (n) => String(n).padStart(24, "0");
const inDays = (d) => new Date(Date.now() + d * 864e5);
const q = (value) => ({ lean: () => q(value), sort: () => q(value), then: (a, b) => Promise.resolve(value).then(a, b) });

let lastFind, created;
test.beforeEach(() => {
  lastFind = null;
  created = [];
  Event.find = (filter) => { lastFind = filter; return q([{ _id: oid(1), title: "Tech Talk", status: "published", date: inDays(2), price: 0 }]); };
  Event.findById = (id) => q(id === oid(1) ? { _id: oid(1), title: "Tech Talk", status: "published" } : id === oid(2) ? { _id: oid(2), status: "draft" } : null);
  Event.create = async (data) => { const doc = { _id: oid(50), ...data }; created.push(doc); return doc; };
  Booking.aggregate = async () => [{ _id: oid(1), n: 3 }];
});

async function call(method, path, { user, body } = {}) {
  const app = express();
  app.use(express.json());
  app.use("/api/events", eventRoutes);
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  try {
    const headers = { "Content-Type": "application/json" };
    if (user) headers.Authorization = `Bearer ${jwt.sign(user, process.env.JWT_SECRET)}`;
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/events${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

const organizer = { id: oid(21), role: "Organizer" };
const attendee = { id: oid(11), role: "Attendee" };
const full = () => ({ title: "Hackathon", description: "24h build", category: "technical", capacity: 50, date: inDays(10).toISOString(), venue: "Lab 3", price: 0 });

test("TC-Event-01: organizer creates an event, it is published and returned with eventId", async () => {
  const res = await call("POST", "", { user: organizer, body: full() });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.status, "published");
  assert.ok(res.body.eventId);
  assert.strictEqual(created[0].category, "Technical");
  assert.strictEqual(String(created[0].organizer), organizer.id);
});

test("TC-Event-04: cannot publish without capacity, date, venue and price", async () => {
  const body = full();
  delete body.capacity;
  delete body.venue;
  const res = await call("POST", "", { user: organizer, body });
  assert.strictEqual(res.status, 400);
  assert.ok(res.body.errors.includes("capacity is required to publish"));
  assert.ok(res.body.errors.includes("venue is required to publish"));
  assert.strictEqual(created.length, 0);
});

test("TC-Event-04: a past date or bad capacity/price is rejected", async () => {
  for (const patch of [{ date: inDays(-1).toISOString() }, { capacity: 0 }, { capacity: 2.5 }, { price: -5 }, { category: "Party" }]) {
    const res = await call("POST", "", { user: organizer, body: { ...full(), ...patch } });
    assert.strictEqual(res.status, 400, JSON.stringify(patch));
  }
});

test("a draft can be saved without the publish details", async () => {
  const res = await call("POST", "", { user: organizer, body: { title: "Idea", description: "TBD", category: "Other", status: "draft" } });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.status, "draft");
});

test("TC-Sec-04: attendees and anonymous users cannot create events", async () => {
  assert.strictEqual((await call("POST", "", { user: attendee, body: full() })).status, 403);
  assert.strictEqual((await call("POST", "", { body: full() })).status, 401);
});

test("TC-Search-01: GET only asks for published, upcoming events and adds registeredCount", async () => {
  const res = await call("GET", "");
  assert.strictEqual(res.status, 200);
  assert.strictEqual(lastFind.status, "published");
  assert.ok(lastFind.date.$gte instanceof Date && lastFind.date.$gte <= new Date());
  assert.strictEqual(res.body.events[0].eventId, oid(1));
  assert.strictEqual(res.body.events[0].registeredCount, 3);
});

test("TC-Search-02: GET passes category, location, from and to filters", async () => {
  const res = await call("GET", "?category=seminar&location=bang&from=2099-01-01&to=2099-01-31");
  assert.strictEqual(res.status, 200);
  assert.ok(lastFind.category.test("Seminar"));
  assert.ok(lastFind.venue.test("Main Hall, Bangalore"));
  assert.strictEqual(lastFind.date.$gte.toISOString(), "2099-01-01T00:00:00.000Z");
  assert.strictEqual(lastFind.date.$lte.toISOString(), "2099-01-31T23:59:59.999Z");
});

test("GET rejects bad from/to dates with 400", async () => {
  assert.strictEqual((await call("GET", "?from=31-01-2099")).status, 400);
  assert.strictEqual((await call("GET", "?from=2099-02-30")).status, 400);
  assert.strictEqual((await call("GET", "?from=2099-02-01&to=2099-01-01")).status, 400);
});

test("GET /:id returns an event, hides drafts and unknown ids", async () => {
  const ok = await call("GET", `/${oid(1)}`);
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.body.registeredCount, 3);
  assert.strictEqual((await call("GET", `/${oid(2)}`)).status, 404);
  assert.strictEqual((await call("GET", `/${oid(9)}`)).status, 404);
  assert.strictEqual((await call("GET", "/not-an-id")).status, 404);
});

test("parseEventFields / publishProblems", () => {
  const { data, errors } = parseEventFields({ title: "  A  ", price: "12.5", capacity: "10" });
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(data, { title: "A", price: 12.5, capacity: 10 });
  assert.deepStrictEqual(publishProblems({ capacity: 1, date: inDays(1), venue: "X", price: 0 }), []);
  assert.strictEqual(publishProblems({}).length, 4);
});

// ---- EMS-F-005 edit event ----
function editableEvent(over = {}) {
  const doc = { _id: oid(7), title: "Old title", description: "d", category: "Seminar", capacity: 10, date: inDays(4), venue: "Hall A", price: 0, status: "published", organizer: organizer.id, ...over };
  doc.toObject = () => ({ ...doc });
  doc.set = (data) => Object.assign(doc, data);
  doc.save = async () => doc;
  return doc;
}

test("TC-Event-02: the organizer edits their event and gets the saved event back", async () => {
  const doc = editableEvent();
  Event.findById = () => doc;
  Booking.aggregate = async () => [];
  const res = await call("PUT", `/${oid(7)}`, { user: organizer, body: { title: "New title", venue: "Hall B", price: "250" } });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.event.title, "New title");
  assert.strictEqual(res.body.event.venue, "Hall B");
  assert.strictEqual(doc.price, 250);
});

test("TC-Event-02: only the owner or an Admin can edit; attendees never", async () => {
  Event.findById = () => editableEvent();
  Booking.aggregate = async () => [];
  const other = { id: oid(22), role: "Organizer" };
  assert.strictEqual((await call("PUT", `/${oid(7)}`, { user: other, body: { title: "X" } })).status, 403);
  assert.strictEqual((await call("PUT", `/${oid(7)}`, { user: attendee, body: { title: "X" } })).status, 403);
  assert.strictEqual((await call("PUT", `/${oid(7)}`, { user: { id: oid(30), role: "Admin" }, body: { title: "X" } })).status, 200);
  assert.strictEqual((await call("PUT", `/${oid(7)}`, { body: { title: "X" } })).status, 401);
});

test("edit validation: bad values, past date, capacity below bookings, cancelled event", async () => {
  Event.findById = () => editableEvent();
  Booking.aggregate = async () => [{ _id: oid(7), n: 6 }];
  for (const body of [{ title: "" }, { capacity: -1 }, { date: inDays(-1).toISOString() }, { capacity: 5 }, {}]) {
    assert.strictEqual((await call("PUT", `/${oid(7)}`, { user: organizer, body })).status, 400, JSON.stringify(body));
  }
  assert.strictEqual((await call("PUT", `/${oid(7)}`, { user: organizer, body: { status: "draft" } })).status, 409);
  Event.findById = () => editableEvent({ status: "cancelled" });
  assert.strictEqual((await call("PUT", `/${oid(7)}`, { user: organizer, body: { title: "X" } })).status, 409);
  assert.strictEqual((await call("PUT", `/${oid(9)}x`, { user: organizer, body: { title: "X" } })).status, 404);
});

test("TC-Event-04 on edit: a draft is only published once every detail is set", async () => {
  Event.findById = () => editableEvent({ status: "draft", capacity: undefined, venue: undefined });
  Booking.aggregate = async () => [];
  const res = await call("PUT", `/${oid(7)}`, { user: organizer, body: { status: "published" } });
  assert.strictEqual(res.status, 400);
  assert.ok(res.body.errors.includes("capacity is required to publish"));
  const ok = await call("PUT", `/${oid(7)}`, { user: organizer, body: { status: "published", capacity: 20, venue: "Lab" } });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.body.event.status, "published");
});

test("GET /mine lists only the organizer's events", async () => {
  const res = await call("GET", "/mine", { user: organizer });
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(lastFind, { organizer: organizer.id });
  await call("GET", "/mine", { user: { id: oid(30), role: "Admin" } });
  assert.deepStrictEqual(lastFind, {});
  assert.strictEqual((await call("GET", "/mine", { user: attendee })).status, 403);
});
