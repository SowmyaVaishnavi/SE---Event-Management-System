// EMS-F-010 book a spot, F-011 QR ticket, F-012 cancel, F-019 scan ticket (check-in), F-020 show ticket.
// Endpoint shapes follow SAD 4.3: POST /api/events/{id}/register -> {status, ticketId, qrCode}; POST /api/checkin/scan -> {status: "checked-in"}.
// Capacity / date / status are read defensively from the Event (the Developer adds them in EMS-F-004..007).
// EMS-F-013: a paid event's booking starts as "pending_payment" and is confirmed by routes/payments.js.
const express = require("express");
const mongoose = require("mongoose");
const Event = require("../models/Event");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const { requireAuth, requireRole } = require("../middleware/auth");
const { startPayment, expireStaleHolds, paymentView, HOLD_MINUTES } = require("./payments");
const audit = require("../lib/auditLog");
const { notify } = require("../lib/notify");

const router = express.Router();

function ticketView(booking, event, payment) {
  return {
    bookingId: booking._id,
    ticketCode: booking.ticketCode,
    status: booking.status,
    checkedInAt: booking.checkedInAt,
    cancelReason: booking.cancelReason ?? null,
    holdExpiresAt: booking.holdExpiresAt ?? null,
    payment: payment ? paymentView(payment) : null,
    bookedAt: booking.createdAt,
    event: event
      ? {
          eventId: event._id,
          title: event.title,
          category: event.category,
          date: event.date ?? null,
          venue: event.venue ?? null,
          price: event.price ?? 0,
        }
      : null,
  };
}

// POST /api/events/:id/register  (F-010) - attendee comes from the JWT, eventId from the path (DEVIATIONS D-05)
router.post("/events/:id/register", requireAuth, requireRole("Attendee"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ message: "Event not found" });

    const event = await Event.findById(id).lean();
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (event.status && event.status !== "published") {
      return res.status(409).json({ message: "This event is not open for booking" });
    }
    if (event.date && new Date(event.date).getTime() < Date.now()) {
      return res.status(409).json({ message: "This event has already started" });
    }

    const paid = Number(event.price) > 0;
    if (paid) await expireStaleHolds(id);

    const existing = await Booking.findOne({ user: req.user.id, event: id, status: { $in: ["confirmed", "pending_payment"] } });
    if (existing) {
      return res.status(409).json({
        message: existing.status === "pending_payment"
          ? "You already have a seat held for this event. Complete the payment under My tickets"
          : "You have already booked this event",
      });
    }

    if (typeof event.capacity === "number") {
      // Seats held by an unpaid booking count as taken until the hold ends.
      const taken = await Booking.countDocuments({ event: id, status: "confirmed" }) +
        (paid ? await Booking.countDocuments({ event: id, status: "pending_payment" }) : 0);
      if (taken >= event.capacity) {
        return res.status(400).json({ message: "Event full. No seats left" });
      }
    }

    if (paid) {
      // EMS-F-013: hold the seat and start the payment; the booking is confirmed only after the payment succeeds.
      const held = await Booking.create({
        user: req.user.id,
        event: id,
        status: "pending_payment",
        holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60000),
      });
      let started;
      try {
        started = await startPayment({ booking: held, event, userId: req.user.id });
      } catch (error) {
        await Booking.deleteOne({ _id: held._id });
        console.error("Start payment failed:", error.message);
        return res.status(502).json({ message: "The payment gateway is not available right now. You have not been charged; please try again." });
      }
      audit.record(req, { category: "booking", action: "booking_held", target: `booking:${held._id}`, detail: { eventId: String(id), holdMinutes: HOLD_MINUTES } });
      return res.status(201).json({
        status: "pending_payment",
        message: `Seat held for ${HOLD_MINUTES} minutes. Complete the payment to confirm your booking.`,
        bookingId: held._id,
        payment: paymentView(started.payment),
        checkout: started.checkout,
        ticket: ticketView(held, event, started.payment),
      });
    }

    const booking = await Booking.create({ user: req.user.id, event: id });
    audit.record(req, { category: "booking", action: "booking_confirmed", target: `booking:${booking._id}`, detail: { eventId: String(id) } });
    // EMS-F-016: confirmation alert (in-app + email) right after a free booking.
    notify([req.user.id], {
      type: "booking_confirmed",
      title: `Booking confirmed: ${event.title}`,
      message: `You're booked for "${event.title}"${event.date ? ` on ${new Date(event.date).toUTCString()}` : ""}. Your ticket is under My tickets.`,
      event: event._id,
    });
    return res.status(201).json({
      status: "confirmed",
      ticketId: booking._id,
      qrCode: booking.ticketCode,
      message: "Booking confirmed",
      ticket: ticketView(booking, event),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "You have already booked this event" });
    }
    console.error("Booking failed:", error.message);
    return res.status(500).json({ message: "Could not complete the booking" });
  }
});

// GET /api/bookings/me  (F-011 / F-020) - my tickets, newest first
router.get("/bookings/me", requireAuth, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id }).sort({ createdAt: -1 }).lean();
    const events = await Event.find({ _id: { $in: bookings.map((b) => b.event) } }).lean();
    const byId = new Map(events.map((e) => [String(e._id), e]));
    // Payments exist only for paid events (EMS-F-013), so skip the lookup when every event is free.
    const payments = events.some((e) => Number(e.price) > 0)
      ? await Payment.find({ booking: { $in: bookings.map((b) => b._id) } }).lean()
      : [];
    const payOf = new Map(payments.map((p) => [String(p.booking), p]));
    res.json({ tickets: bookings.map((b) => ticketView(b, byId.get(String(b.event)), payOf.get(String(b._id)))) });
  } catch (error) {
    console.error("Load tickets failed:", error.message);
    res.status(500).json({ message: "Could not load your tickets" });
  }
});

// POST /api/bookings/:id/cancel  (F-012)
router.post("/bookings/:id/cancel", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ message: "Booking not found" });

    const booking = await Booking.findById(id);
    // Same answer for "not found" and "not yours" so ids cannot be probed.
    if (!booking || String(booking.user) !== String(req.user.id)) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.status === "cancelled") {
      return res.status(409).json({ message: "This booking is already cancelled" });
    }
    if (booking.checkedInAt) {
      return res.status(409).json({ message: "You have already checked in, so this booking cannot be cancelled" });
    }

    const event = await Event.findById(booking.event).lean();
    if (event?.date && new Date(event.date).getTime() < Date.now()) {
      return res.status(409).json({ message: "This event has already started" });
    }

    const wasPending = booking.status === "pending_payment";
    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    booking.cancelReason = "attendee";
    await booking.save();
    audit.record(req, { category: "booking", action: "booking_cancelled", target: `booking:${booking._id}`, detail: { eventId: String(booking.event), wasPendingPayment: wasPending } });

    let message = "Booking cancelled. Your seat has been released";
    if (Number(event?.price) > 0) {
      if (wasPending) {
        await Payment.updateOne({ booking: booking._id, status: "created" }, { $set: { status: "failed", failureReason: "Booking cancelled before paying" } });
      } else {
        message += ". Your payment will be refunded by the organizers (you will get an alert when it is done)";
      }
    }
    return res.json({ message, ticket: ticketView(booking, event) });
  } catch (error) {
    console.error("Cancel failed:", error.message);
    return res.status(500).json({ message: "Could not cancel the booking" });
  }
});

// POST /api/checkin/scan  (F-019) - Organizer/Admin scans a ticket QR. Body: { qrCode, ticketId? }
router.post("/checkin/scan", requireAuth, requireRole("Organizer", "Admin"), async (req, res) => {
  try {
    const raw = req.body?.qrCode ?? req.body?.ticketCode;
    const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
    if (!code) return res.status(400).json({ message: "Enter or scan a ticket code" });

    const refused = (reason, booking) =>
      audit.record(req, { category: "booking", action: "checkin_refused", outcome: "failure", target: booking ? `booking:${booking._id}` : "", detail: { reason } });

    const booking = await Booking.findOne({ ticketCode: code }).populate("user", "name email");
    if (!booking) refused("unknown_ticket");
    if (!booking) return res.status(400).json({ message: "Invalid ticket. No booking found for this code" });

    const event = await Event.findById(booking.event).lean();
    const attendee = booking.user ? { name: booking.user.name, email: booking.user.email } : null;

    if (booking.status === "cancelled") {
      refused("ticket_cancelled", booking);
      return res.status(400).json({ message: "This ticket was cancelled", attendee, ticket: ticketView(booking, event) });
    }
    if (booking.status === "pending_payment") {
      refused("not_paid", booking);
      return res.status(400).json({ message: "This ticket is not paid yet", attendee, ticket: ticketView(booking, event) });
    }
    if (req.body?.ticketId && String(req.body.ticketId) !== String(booking._id)) {
      refused("ticket_id_mismatch", booking);
      return res.status(400).json({ message: "Invalid ticket. The ticket id does not match this QR code" });
    }
    if (booking.checkedInAt) {
      refused("already_used", booking);
      return res.status(400).json({
        message: "Already checked in",
        attendee,
        ticket: ticketView(booking, event),
      });
    }

    booking.checkedInAt = new Date();
    await booking.save();
    audit.record(req, { category: "booking", action: "checkin_success", target: `booking:${booking._id}`, detail: { eventId: String(booking.event) } });
    return res.json({ status: "checked-in", message: "Check-in successful", attendee, ticket: ticketView(booking, event) });
  } catch (error) {
    console.error("Check-in failed:", error.message);
    return res.status(500).json({ message: "Could not check in this ticket" });
  }
});

module.exports = router;