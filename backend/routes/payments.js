// /api/payments - EMS-F-013 pay, F-014 receipt, F-015 refund (Admin). See docs/PAYMENTS.md.
//
// Flow for a paid event:
//  1. POST /api/events/:id/register  -> booking "pending_payment" (seat held 15 min) + payment "created" + gateway order
//  2. The attendee pays on the gateway's page (sandbox: POST /api/payments/:id/sandbox-checkout)
//  3. POST /api/payments/:id/confirm with the gateway's { paymentId, signature }
//     -> signature checked -> payment "paid", booking "confirmed", receipt number issued
//  A failed payment releases the seat. Only a confirmed (paid) booking has a working ticket.
const express = require("express");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Booking = require("../models/Booking");
const Event = require("../models/Event");
const User = require("../models/User");
const { requireAuth, requireRole } = require("../middleware/auth");
const { getGateway } = require("../lib/paymentGateway");
const { notify } = require("../lib/notify");

const router = express.Router();
const HOLD_MINUTES = 15;

const rupees = (paise) => Math.round(paise) / 100;
const formatInr = (paise) => `₹${rupees(paise).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

function paymentView(p) {
  return {
    paymentId: p._id,
    bookingId: p.booking,
    eventId: p.event,
    amount: rupees(p.amountPaise),
    currency: p.currency,
    provider: p.provider,
    status: p.status,
    paidAt: p.paidAt,
    receiptNumber: p.receiptNumber ?? null,
    refundDue: Boolean(p.refundDue),
    refundedAt: p.refund?.refundedAt ?? null,
    failureReason: p.failureReason || "",
    // What the browser needs to reopen the gateway's checkout for an unpaid booking.
    checkout: p.status === "created"
      ? { provider: p.provider, orderId: p.providerOrderId, amount: p.amountPaise, currency: p.currency,
          ...(p.provider === "razorpay" ? { keyId: process.env.RAZORPAY_KEY_ID } : {}) }
      : null,
  };
}

// F-014: everything the receipt shows. Built from the stored payment, so it always matches what was charged.
function receiptView(p, event, user, booking) {
  return {
    receiptNumber: p.receiptNumber,
    status: p.status,
    amount: rupees(p.amountPaise),
    amountText: formatInr(p.amountPaise),
    currency: p.currency,
    paidAt: p.paidAt,
    paymentReference: p.providerPaymentId,
    provider: p.provider,
    refundedAt: p.refund?.refundedAt ?? null,
    event: event ? { eventId: event._id, title: event.title, date: event.date ?? null, venue: event.venue ?? null } : null,
    attendee: user ? { name: user.name, email: user.email } : null,
    ticketCode: booking?.ticketCode ?? null,
  };
}

async function loadOwnPayment(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ message: "Payment not found" });
    return null;
  }
  const payment = await Payment.findById(id);
  // Same answer for "not found" and "not yours" so ids cannot be probed.
  if (!payment || (String(payment.user) !== String(req.user.id) && req.user.role !== "Admin")) {
    res.status(404).json({ message: "Payment not found" });
    return null;
  }
  return payment;
}

// Called by POST /api/events/:id/register for a paid event (bookings.js).
async function startPayment({ booking, event, userId, gateway = getGateway() }) {
  const amountPaise = Math.round(Number(event.price) * 100);
  const order = await gateway.createOrder({ amountPaise, currency: "INR", receipt: String(booking._id) });
  const payment = await Payment.create({
    booking: booking._id,
    user: userId,
    event: event._id,
    amountPaise,
    currency: "INR",
    provider: gateway.name,
    providerOrderId: order.orderId,
  });
  return { payment, checkout: order.checkout };
}

// Releases seats whose 15-minute hold ran out without a payment.
async function expireStaleHolds(eventId) {
  const filter = { status: "pending_payment", holdExpiresAt: { $lt: new Date() } };
  if (eventId) filter.event = eventId;
  const stale = await Booking.find(filter, { _id: 1 }).lean();
  if (!stale.length) return 0;
  const ids = stale.map((b) => b._id);
  await Booking.updateMany({ _id: { $in: ids }, status: "pending_payment" }, { $set: { status: "cancelled", cancelledAt: new Date(), cancelReason: "payment_expired" } });
  await Payment.updateMany({ booking: { $in: ids }, status: "created" }, { $set: { status: "failed", failureReason: "Payment not completed within the hold time" } });
  return ids.length;
}

// GET /api/payments/me - my payments, newest first
router.get("/me", requireAuth, async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user.id }).sort({ createdAt: -1 }).lean();
    res.json({ payments: payments.map(paymentView) });
  } catch (error) {
    console.error("Load payments failed:", error.message);
    res.status(500).json({ message: "Could not load your payments" });
  }
});

// GET /api/payments - Admin: all payments (?status=paid|refunded|failed|created), with refund eligibility (F-015)
router.get("/", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const filter = {};
    if (["created", "paid", "failed", "refunded"].includes(req.query.status)) filter.status = req.query.status;
    const payments = await Payment.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    const [events, users, bookings] = await Promise.all([
      Event.find({ _id: { $in: payments.map((p) => p.event) } }, { title: 1, date: 1, status: 1 }).lean(),
      User.find({ _id: { $in: payments.map((p) => p.user) } }, { name: 1, email: 1 }).lean(),
      Booking.find({ _id: { $in: payments.map((p) => p.booking) } }, { status: 1 }).lean(),
    ]);
    const byId = (list) => new Map(list.map((x) => [String(x._id), x]));
    const ev = byId(events);
    const us = byId(users);
    const bk = byId(bookings);
    res.json({
      payments: payments.map((p) => {
        const event = ev.get(String(p.event));
        const booking = bk.get(String(p.booking));
        return {
          ...paymentView(p),
          event: event ? { title: event.title, date: event.date, status: event.status } : null,
          attendee: us.get(String(p.user)) ? { name: us.get(String(p.user)).name, email: us.get(String(p.user)).email } : null,
          bookingStatus: booking?.status ?? null,
          refundable: refundProblem(p, event, booking) === null,
        };
      }),
    });
  } catch (error) {
    console.error("Admin payments list failed:", error.message);
    res.status(500).json({ message: "Could not load payments" });
  }
});

// POST /api/payments/:id/sandbox-checkout - the built-in test gateway's "payment page".
// Body: { outcome: "success" | "failure" }. Never card details. Disabled when a real gateway is configured.
router.post("/:id/sandbox-checkout", requireAuth, async (req, res) => {
  try {
    const gateway = getGateway();
    if (gateway.name !== "sandbox") return res.status(404).json({ message: "Test checkout is not available" });
    const payment = await loadOwnPayment(req, res);
    if (!payment) return;
    if (payment.status !== "created") return res.status(409).json({ message: `This payment is already ${payment.status}` });
    const outcome = req.body?.outcome === "failure" ? "failure" : "success";
    const result = gateway.simulateCheckout(payment.providerOrderId, outcome);
    if (!result.ok) return res.status(402).json({ message: result.reason });
    res.json({ orderId: payment.providerOrderId, paymentId: result.paymentId, signature: result.signature });
  } catch (error) {
    console.error("Sandbox checkout failed:", error.message);
    res.status(500).json({ message: "Could not reach the test gateway" });
  }
});

// POST /api/payments/:id/confirm (F-013) - Body: { paymentId, signature } from the gateway checkout.
router.post("/:id/confirm", requireAuth, async (req, res) => {
  try {
    const payment = await loadOwnPayment(req, res);
    if (!payment) return;
    const { paymentId, signature } = req.body || {};

    if (payment.status === "paid" && payment.providerPaymentId === paymentId) {
      // Retried confirm (e.g. double click): answer the same way again.
      const [event, user, booking] = await Promise.all([Event.findById(payment.event).lean(), User.findById(payment.user).lean(), Booking.findById(payment.booking).lean()]);
      return res.json({ status: "paid", message: "Payment already confirmed", payment: paymentView(payment), receipt: receiptView(payment, event, user, booking) });
    }
    // "failed" is allowed here: the hold may have expired (or the event been cancelled) while the attendee was
    // still paying. If the gateway then proves the money was taken, it must be recorded and refunded.
    if (!["created", "failed"].includes(payment.status)) {
      return res.status(409).json({ message: `This payment is already ${payment.status}` });
    }

    const gateway = getGateway();
    if (gateway.name !== payment.provider) return res.status(409).json({ message: "This payment was started with a different gateway" });
    if (typeof paymentId !== "string" || typeof signature !== "string" ||
        !gateway.verifyPayment({ orderId: payment.providerOrderId, paymentId, signature })) {
      return res.status(400).json({ message: "Payment could not be verified. Your booking is not confirmed." });
    }

    payment.providerPaymentId = paymentId;
    payment.paidAt = new Date();
    payment.status = "paid";
    payment.receiptNumber = Payment.generateReceiptNumber(payment.paidAt);

    const booking = await Booking.findById(payment.booking);
    const event = await Event.findById(payment.event).lean();
    const user = await User.findById(payment.user).lean();

    // The money was taken but the seat is gone (hold expired or event cancelled): keep the record and flag a refund.
    if (!booking || booking.status !== "pending_payment" || event?.status === "cancelled") {
      payment.refundDue = true;
      await payment.save();
      return res.status(409).json({
        message: "Your seat hold ended before the payment arrived, so the booking is not confirmed. The payment will be refunded.",
        payment: paymentView(payment),
      });
    }

    await payment.save();
    booking.status = "confirmed";
    booking.holdExpiresAt = null;
    await booking.save();

    notify([payment.user], {
      type: "payment_received",
      title: `Payment received: ${event?.title ?? "your event"}`,
      message: `We received ${formatInr(payment.amountPaise)} for "${event?.title ?? "your event"}". Receipt ${payment.receiptNumber}. Your ticket is under My tickets.`,
      event: payment.event,
    });

    return res.json({
      status: "paid",
      message: "Payment successful. Your booking is confirmed.",
      payment: paymentView(payment),
      receipt: receiptView(payment, event, user, booking),
    });
  } catch (error) {
    console.error("Confirm payment failed:", error.message);
    return res.status(500).json({ message: "Could not confirm the payment" });
  }
});

// POST /api/payments/:id/fail - the gateway reported a failed or abandoned payment. Releases the held seat.
router.post("/:id/fail", requireAuth, async (req, res) => {
  try {
    const payment = await loadOwnPayment(req, res);
    if (!payment) return;
    if (payment.status !== "created") return res.status(409).json({ message: `This payment is already ${payment.status}` });
    const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 200) : "Payment failed";
    payment.status = "failed";
    payment.failureReason = reason;
    await payment.save();
    await Booking.updateOne(
      { _id: payment.booking, status: "pending_payment" },
      { $set: { status: "cancelled", cancelledAt: new Date(), cancelReason: "payment_failed" } }
    );
    res.json({ status: "failed", message: "Payment failed, so the booking was not confirmed and your seat was released. You can try booking again." });
  } catch (error) {
    console.error("Fail payment failed:", error.message);
    res.status(500).json({ message: "Could not update the payment" });
  }
});

// GET /api/payments/:id/receipt (F-014) - the attendee who paid, or an Admin
router.get("/:id/receipt", requireAuth, async (req, res) => {
  try {
    const payment = await loadOwnPayment(req, res);
    if (!payment) return;
    if (!["paid", "refunded"].includes(payment.status)) {
      return res.status(409).json({ message: "A receipt is available once the payment succeeds" });
    }
    const [event, user, booking] = await Promise.all([
      Event.findById(payment.event).lean(),
      User.findById(payment.user).lean(),
      Booking.findById(payment.booking).lean(),
    ]);
    res.json({ receipt: receiptView(payment, event, user, booking) });
  } catch (error) {
    console.error("Load receipt failed:", error.message);
    res.status(500).json({ message: "Could not load the receipt" });
  }
});

// F-015 eligibility: paid, not yet refunded, and the booking/event is cancelled, the payment arrived too late,
// or the event has not started yet. Returns null when a refund is allowed, else the reason it is not.
function refundProblem(payment, event, booking) {
  if (payment.status === "refunded") return "This payment is already refunded";
  if (payment.status !== "paid") return "Only a successful payment can be refunded";
  if (payment.refundDue || booking?.status === "cancelled" || event?.status === "cancelled") return null;
  if (event?.date && new Date(event.date).getTime() <= Date.now()) {
    return "The event has already started and the booking was not cancelled, so it is not eligible for a refund";
  }
  return null;
}

// POST /api/payments/:id/refund (F-015) - Admin only. Body: { reason? }
// Refunds through the gateway, cancels the booking if it was still active, and tells the attendee.
router.post("/:id/refund", requireAuth, requireRole("Admin"), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ message: "Payment not found" });
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 300) : "";
  try {
    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    const [event, booking] = await Promise.all([Event.findById(payment.event).lean(), Booking.findById(payment.booking)]);
    const problem = refundProblem(payment, event, booking);
    if (problem) return res.status(409).json({ message: problem });

    const gateway = getGateway();
    if (gateway.name !== payment.provider) return res.status(409).json({ message: "This payment was made with a different gateway" });

    let refund;
    try {
      refund = await gateway.refund({ paymentId: payment.providerPaymentId, amountPaise: payment.amountPaise });
    } catch (error) {
      console.error("Gateway refund failed:", error.message);
      return res.status(502).json({ message: "The payment gateway did not accept the refund. Nothing was changed; try again later." });
    }

    payment.status = "refunded";
    payment.refundDue = false;
    payment.refund = { providerRefundId: refund.refundId, refundedAt: new Date(), refundedBy: req.user.id, reason };
    await payment.save();

    if (booking && booking.status !== "cancelled") {
      booking.status = "cancelled";
      booking.cancelledAt = new Date();
      booking.cancelReason = "refunded";
      await booking.save();
    }

    const title = event?.title ?? "your event";
    await notify([payment.user], {
      type: "refund_completed",
      title: `Refund completed: ${title}`,
      message: `Your payment of ${formatInr(payment.amountPaise)} for "${title}" (receipt ${payment.receiptNumber}) has been refunded.` +
        (reason ? ` Reason: ${reason}.` : "") + " It can take 5-7 working days to reach your account.",
      event: payment.event,
    });

    res.json({ status: "refunded", message: "Refund completed and the attendee was told.", payment: paymentView(payment) });
  } catch (error) {
    console.error("Refund failed:", error.message);
    res.status(500).json({ message: "Could not complete the refund" });
  }
});

module.exports = router;
module.exports.startPayment = startPayment;
module.exports.expireStaleHolds = expireStaleHolds;
module.exports.refundProblem = refundProblem;
module.exports.paymentView = paymentView;
module.exports.HOLD_MINUTES = HOLD_MINUTES;
