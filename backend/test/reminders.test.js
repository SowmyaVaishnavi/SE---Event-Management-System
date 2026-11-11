// Tests for EMS-F-017 event reminders. Models are stubbed. Run: npm test
const test = require("node:test");
const assert = require("node:assert");
const Event = require("../models/Event");
const Booking = require("../models/Booking");
const Notification = require("../models/Notification");
const { sendDueReminders } = require("../lib/reminders");

const oid = (n) => String(n).padStart(24, "0");
const q = (value) => ({ lean: () => q(value), then: (a, b) => Promise.resolve(value).then(a, b) });
const now = new Date("2026-11-11T10:00:00Z");
const inHours = (h) => new Date(now.getTime() + h * 3600000);

let events, bookings, notes, sentCalls;
const fakeNotify = async (users, payload) => { sentCalls.push({ users, payload }); return users.length; };

test.beforeEach(() => {
  events = [
    { _id: oid(1), title: "Soon", status: "published", date: inHours(5), venue: "Hall A" },
    { _id: oid(2), title: "Far", status: "published", date: inHours(72) },
  ];
  bookings = [
    { user: oid(11), event: oid(1), status: "confirmed" },
    { user: oid(12), event: oid(1), status: "confirmed" },
  ];
  notes = [];
  sentCalls = [];
  Event.find = (f) => q(events.filter((e) => e.status === f.status && e.date > f.date.$gt && e.date <= f.date.$lte));
  Booking.find = (f) => q(bookings.filter((b) => f.event.$in.includes(b.event) && b.status === f.status));
  Notification.find = () => q(notes);
});

test("reminds everyone booked on an event starting within 24 hours", async () => {
  const n = await sendDueReminders({ now, notifyImpl: fakeNotify });
  assert.equal(n, 2);
  assert.equal(sentCalls.length, 1);
  assert.deepEqual(sentCalls[0].users, [oid(11), oid(12)]);
  assert.equal(sentCalls[0].payload.type, "event_reminder");
  assert.match(sentCalls[0].payload.message, /Hall A/);
});

test("skips events outside the window", async () => {
  events[0].date = inHours(72);
  assert.equal(await sendDueReminders({ now, notifyImpl: fakeNotify }), 0);
  assert.equal(sentCalls.length, 0);
});

test("does not remind someone twice", async () => {
  notes = [{ user: oid(11), event: oid(1), type: "event_reminder" }];
  await sendDueReminders({ now, notifyImpl: fakeNotify });
  assert.deepEqual(sentCalls[0].users, [oid(12)]);
});

test("ignores cancelled bookings and cancelled events", async () => {
  bookings[1].status = "cancelled";
  await sendDueReminders({ now, notifyImpl: fakeNotify });
  assert.deepEqual(sentCalls[0].users, [oid(11)]);
  events[0].status = "cancelled";
  sentCalls = [];
  assert.equal(await sendDueReminders({ now, notifyImpl: fakeNotify }), 0);
});