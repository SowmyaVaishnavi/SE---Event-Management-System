// Whole-flow tests for EMS-F-013 (pay), F-014 (receipt), F-015 (refund) and SR-003 (no card data),
// using the built-in sandbox gateway and an in-memory fake database. Run: npm test
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
const bookingRoutes = require("../routes/bookings");
const paymentRoutes = require("../routes/payments");
const { rejectCardData } = require("../lib/cardData");
const { install } = require("./helpers/fakeDb");
const { razorpayGateway, hmac } = require("../lib/paymentGateway");

const oid = (n) => String(n).padStart(24, "0");
const inDays = (d) => new Date(Date.now() + d * 864e5);
const asha = { id: oid(11), role: "Attendee" };
const ravi = { id: oid(12), role: "Attendee" };
const admin = { id: oid(30), role: "Admin" };
const organizer = { id: oid(21), role: "Organizer" };
let db;

test.beforeEach(() => {
  db = {
    events: install(Event, [
      { _id: oid(1), title: "Music Night", category: "Cultural", date: inDays(5), venue: "Open Air Theatre", capacity: 1, price: 499.5, status: "published" },
      { _id: oid(2), title: "Free Talk", category: "Seminar", date: inDays(5), venue: "Hall", capacity: 10, price: 0, status: "published" },
    ]),
    bookings: install(Booking, []),
    payments: install(Payment, []),
    users: install(User, [
      { _id: oid(11), name: "Asha", email: "asha@example.com", role: "Attendee" },
      { _id: oid(12), name: "Ravi", email: "ravi@example.com", role: "Attendee" },
    ]),
    notes: install(Notification, []),
  };
});

async function call(method, path, { user, body } = {}) {
  const app = express();
  app.use(express.json());
  app.use(rejectCardData);
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

async function bookAndPay(user = asha) {
  const booked = await call("POST", `/events/${oid(1)}/register`, { user });
  const paymentId = booked.body.payment.paymentId;
  const gw = await call("POST", `/payments/${paymentId}/sandbox-checkout`, { user, body: { outcome: "success" } });
  const confirmed = await call("POST", `/payments/${paymentId}/confirm`, { user, body: { paymentId: gw.body.paymentId, signature: gw.body.signature } });
  return { booked, gw, confirmed, paymentId };
}

test("TC-Pay-01: a paid booking waits for payment, then is confirmed once the payment succeeds", async () => {
  const booked = await call("POST", `/events/${oid(1)}/register`, { user: asha });
  assert.strictEqual(booked.status, 201);
  assert.strictEqual(booked.body.status, "pending_payment");
  assert.strictEqual(booked.body.payment.amount, 499.5);
  assert.strictEqual(db.payments[0].amountPaise, 49950);
  assert.strictEqual(db.bookings[0].status, "pending_payment");

  // Not paid yet: the ticket does not work at check-in.
  const early = await call("POST", "/checkin/scan", { user: organizer, body: { qrCode: db.bookings[0].ticketCode } });
  assert.deepStrictEqual([early.status, early.body.message], [400, "This ticket is not paid yet"]);

  const paymentId = booked.body.payment.paymentId;
  const gw = await call("POST", `/payments/${paymentId}/sandbox-checkout`, { user: asha, body: { outcome: "success" } });
  assert.strictEqual(gw.status, 200);

  // A forged signature is rejected and nothing is confirmed.
  const forged = await call("POST", `/payments/${paymentId}/confirm`, { user: asha, body: { paymentId: gw.body.paymentId, signature: "0".repeat(64) } });
  assert.strictEqual(forged.status, 400);
  assert.strictEqual(db.bookings[0].status, "pending_payment");

  const ok = await call("POST", `/payments/${paymentId}/confirm`, { user: asha, body: { paymentId: gw.body.paymentId, signature: gw.body.signature } });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.body.status, "paid");
  assert.strictEqual(db.bookings[0].status, "confirmed");
  assert.strictEqual(db.payments[0].status, "paid");
  assert.ok(db.notes.some((n) => n.type === "payment_received" && String(n.user) === asha.id));
  assert.ok(db.notes.some((n) => n.type === "booking_confirmed" && String(n.user) === asha.id)); // EMS-F-016

  // Retrying the same confirm is safe.
  const again = await call("POST", `/payments/${paymentId}/confirm`, { user: asha, body: { paymentId: gw.body.paymentId, signature: gw.body.signature } });
  assert.strictEqual(again.status, 200);

  const scan = await call("POST", "/checkin/scan", { user: organizer, body: { qrCode: db.bookings[0].ticketCode } });
  assert.strictEqual(scan.status, 200);
});

test("TC-Pay-01: a failed payment does not confirm the booking and releases the seat", async () => {
  const booked = await call("POST", `/events/${oid(1)}/register`, { user: asha });
  const paymentId = booked.body.payment.paymentId;
  // Capacity is 1 and the seat is held, so Ravi cannot book.
  assert.strictEqual((await call("POST", `/events/${oid(1)}/register`, { user: ravi })).status, 400);

  const declined = await call("POST", `/payments/${paymentId}/sandbox-checkout`, { user: asha, body: { outcome: "failure" } });
  assert.strictEqual(declined.status, 402);
  const failed = await call("POST", `/payments/${paymentId}/fail`, { user: asha, body: { reason: "Card declined" } });
  assert.strictEqual(failed.status, 200);
  assert.strictEqual(db.bookings[0].status, "cancelled");
  assert.strictEqual(db.bookings[0].cancelReason, "payment_failed");
  assert.strictEqual(db.payments[0].status, "failed");

  // Seat released: Ravi can book now.
  assert.strictEqual((await call("POST", `/events/${oid(1)}/register`, { user: ravi })).status, 201);
});

test("an expired seat hold is released; paying late flags a refund instead of confirming", async () => {
  const booked = await call("POST", `/events/${oid(1)}/register`, { user: asha });
  const paymentId = booked.body.payment.paymentId;
  const gw = await call("POST", `/payments/${paymentId}/sandbox-checkout`, { user: asha, body: { outcome: "success" } });
  db.bookings[0].holdExpiresAt = new Date(Date.now() - 1000);

  // Ravi's booking attempt expires Asha's stale hold and takes the seat.
  const ravis = await call("POST", `/events/${oid(1)}/register`, { user: ravi });
  assert.strictEqual(ravis.status, 201);
  assert.strictEqual(db.bookings[0].cancelReason, "payment_expired");

  // Asha's payment had already gone through at the gateway: it is recorded as paid and flagged for refund,
  // but her booking is not confirmed (the seat is Ravi's now).
  const late = await call("POST", `/payments/${paymentId}/confirm`, { user: asha, body: { paymentId: gw.body.paymentId, signature: gw.body.signature } });
  assert.strictEqual(late.status, 409);
  assert.match(late.body.message, /will be refunded/);
  assert.strictEqual(db.bookings[0].status, "cancelled");
  assert.strictEqual(db.payments[0].status, "paid");
  assert.strictEqual(db.payments[0].refundDue, true);

  // The Admin sees it as refundable and refunds it.
  const list = await call("GET", "/payments?status=paid", { user: admin });
  assert.strictEqual(list.body.payments[0].refundable, true);
  assert.strictEqual((await call("POST", `/payments/${paymentId}/refund`, { user: admin })).status, 200);

  // A failed payment with a bad signature is still refused.
  const other = await call("POST", `/payments/${paymentId}/confirm`, { user: asha, body: { paymentId: "pay_x", signature: "bad" } });
  assert.strictEqual(other.status, 409);
});

test("TC-Pay-02: the receipt shows the right amount, event and date right after paying", async () => {
  const { confirmed, paymentId } = await bookAndPay();
  const r = confirmed.body.receipt;
  assert.match(r.receiptNumber, /^RCPT-\d{8}-[0-9A-F]{6}$/);
  assert.strictEqual(r.amount, 499.5);
  assert.strictEqual(r.amountText, "₹499.50");
  assert.strictEqual(r.event.title, "Music Night");
  assert.strictEqual(new Date(r.event.date).getTime(), db.events[0].date.getTime());
  assert.ok(Math.abs(new Date(r.paidAt) - Date.now()) < 60000);
  assert.strictEqual(r.attendee.name, "Asha");

  const again = await call("GET", `/payments/${paymentId}/receipt`, { user: asha });
  assert.strictEqual(again.status, 200);
  assert.strictEqual(again.body.receipt.receiptNumber, r.receiptNumber);
  // Another attendee cannot see it; an Admin can.
  assert.strictEqual((await call("GET", `/payments/${paymentId}/receipt`, { user: ravi })).status, 404);
  assert.strictEqual((await call("GET", `/payments/${paymentId}/receipt`, { user: admin })).status, 200);
});

test("receipts are only for successful payments; My tickets shows the payment", async () => {
  const booked = await call("POST", `/events/${oid(1)}/register`, { user: asha });
  assert.strictEqual((await call("GET", `/payments/${booked.body.payment.paymentId}/receipt`, { user: asha })).status, 409);
  const mine = await call("GET", "/bookings/me", { user: asha });
  assert.strictEqual(mine.body.tickets[0].payment.status, "created");
  assert.strictEqual(mine.body.tickets[0].status, "pending_payment");
});

test("TC-Pay-03: only an Admin can refund, and the attendee is told once it is done", async () => {
  const { paymentId } = await bookAndPay();
  assert.strictEqual((await call("POST", `/payments/${paymentId}/refund`, { user: asha })).status, 403);
  assert.strictEqual((await call("POST", `/payments/${paymentId}/refund`, { user: organizer })).status, 403);

  const list = await call("GET", "/payments?status=paid", { user: admin });
  assert.strictEqual(list.status, 200);
  assert.strictEqual(list.body.payments[0].refundable, true);
  assert.strictEqual(list.body.payments[0].attendee.email, "asha@example.com");

  const res = await call("POST", `/payments/${paymentId}/refund`, { user: admin, body: { reason: "Requested by attendee" } });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(db.payments[0].status, "refunded");
  assert.match(db.payments[0].refund.providerRefundId, /^rfnd_sbx_/);
  assert.strictEqual(db.bookings[0].status, "cancelled");
  assert.strictEqual(db.bookings[0].cancelReason, "refunded");
  const told = db.notes.find((n) => n.type === "refund_completed");
  assert.ok(told && String(told.user) === asha.id);
  assert.match(told.message, /₹499\.50/);

  assert.strictEqual((await call("POST", `/payments/${paymentId}/refund`, { user: admin })).status, 409, "no double refund");
});

test("TC-Pay-03: refund eligibility - cancelled bookings yes, a past event that went ahead no", async () => {
  const { paymentId } = await bookAndPay();
  db.events[0].date = inDays(-1);
  const refused = await call("POST", `/payments/${paymentId}/refund`, { user: admin });
  assert.strictEqual(refused.status, 409);
  assert.match(refused.body.message, /not eligible/);

  db.events[0].status = "cancelled"; // F-006: organizer cancelled it
  assert.strictEqual((await call("POST", `/payments/${paymentId}/refund`, { user: admin })).status, 200);
});

test("a refund the gateway rejects changes nothing", async () => {
  const { paymentId } = await bookAndPay();
  const gateway = require("../lib/paymentGateway");
  const original = gateway.getGateway;
  // Make the sandbox gateway fail the refund call.
  const failing = { ...original(), refund: async () => { throw new Error("gateway down"); } };
  require.cache[require.resolve("../lib/paymentGateway")].exports.getGateway = () => failing;
  try {
    // payments.js captured getGateway at load time, so this checks the 502 path through a fresh require.
    delete require.cache[require.resolve("../routes/payments")];
    const fresh = require("../routes/payments");
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.headers.authorization = `Bearer ${jwt.sign(admin, process.env.JWT_SECRET)}`; next(); });
    app.use("/api/payments", fresh);
    const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/payments/${paymentId}/refund`, { method: "POST" });
    server.close();
    assert.strictEqual(res.status, 502);
    assert.strictEqual(db.payments[0].status, "paid");
    assert.strictEqual(db.bookings[0].status, "confirmed");
  } finally {
    require.cache[require.resolve("../lib/paymentGateway")].exports.getGateway = original;
    delete require.cache[require.resolve("../routes/payments")];
  }
});

test("free events stay one step: confirmed straight away, no payment record", async () => {
  const res = await call("POST", `/events/${oid(2)}/register`, { user: asha });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.status, "confirmed");
  assert.strictEqual(db.payments.length, 0);
});

test("TC-Sec-03: requests carrying card details are refused and nothing is stored", async () => {
  const booked = await call("POST", `/events/${oid(1)}/register`, { user: asha });
  const paymentId = booked.body.payment.paymentId;
  for (const body of [{ cardNumber: "4111 1111 1111 1111" }, { cvv: "123" }, { note: "my card 5555-5555-5555-4444" }, { nested: { pan: "x" } }]) {
    const res = await call("POST", `/payments/${paymentId}/sandbox-checkout`, { user: asha, body });
    assert.strictEqual(res.status, 400, JSON.stringify(body));
    assert.match(res.body.message, /never accepts card numbers/);
  }
  assert.strictEqual(db.payments[0].status, "created");
  // The Payment schema refuses unknown fields outright.
  db.payments[0].cardNumber = "4111111111111111";
  await assert.rejects(() => db.payments[0].save(), /cardNumber/);
});

test("Razorpay adapter: creates orders, verifies the HMAC signature, refunds via the API", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body), auth: opts.headers.Authorization });
    if (url.endsWith("/orders")) return { ok: true, json: async () => ({ id: "order_ABC" }) };
    return { ok: true, json: async () => ({ id: "rfnd_XYZ" }) };
  };
  const gw = razorpayGateway({ RAZORPAY_KEY_ID: "rzp_test_k", RAZORPAY_KEY_SECRET: "s3cret" }, fetchImpl);
  const order = await gw.createOrder({ amountPaise: 49950, currency: "INR", receipt: "b1" });
  assert.deepStrictEqual(order.checkout, { provider: "razorpay", keyId: "rzp_test_k", orderId: "order_ABC", amount: 49950, currency: "INR" });
  assert.strictEqual(calls[0].auth, `Basic ${Buffer.from("rzp_test_k:s3cret").toString("base64")}`);
  const signature = hmac("s3cret", "order_ABC|pay_1");
  assert.strictEqual(gw.verifyPayment({ orderId: "order_ABC", paymentId: "pay_1", signature }), true);
  assert.strictEqual(gw.verifyPayment({ orderId: "order_ABC", paymentId: "pay_2", signature }), false);
  assert.deepStrictEqual(await gw.refund({ paymentId: "pay_1", amountPaise: 49950 }), { refundId: "rfnd_XYZ" });
  assert.match(calls[1].url, /\/payments\/pay_1\/refund$/);
});
