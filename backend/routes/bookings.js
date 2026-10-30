// EMS-F-010 book a spot, F-011 QR ticket, F-012 cancel, F-019 scan ticket (check-in), F-020 show ticket.
// Endpoint shapes follow SAD 4.3: POST /api/events/{id}/register -> {status, ticketId, qrCode}; POST /api/checkin/scan -> {status: "checked-in"}.
// Capacity / date / status are read defensively from the Event (the Developer adds them in EMS-F-004..007).
const express = require("express");
const mongoose = require("mongoose");
const Event = require("../models/Event");
const Booking = require("../models/Booking");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

function ticketView(booking, event) {
  return {
    bookingId: booking._id,
    ticketCode: booking.ticketCode,
    status: booking.status,
    checkedInAt: booking.checkedInAt,
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

    const existing = await Booking.findOne({ user: req.user.id, event: id, status: "confirmed" });
    if (existing) {
      return res.status(409).json({ message: "You have already booked this event" });
    }

    if (typeof event.capacity === "number") {
      const taken = await Booking.countDocuments({ event: id, status: "confirmed" });
      if (taken >= event.capacity) {
        return res.status(400).json({ message: "Event full. No seats left" });
      }
    }

    const booking = await Booking.create({ user: req.user.id, event: id });
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
    res.json({ tickets: bookings.map((b) => ticketView(b, byId.get(String(b.event)))) });
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

    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    await booking.save();
    return res.json({ message: "Booking cancelled. Your seat has been released", ticket: ticketView(booking, event) });
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

    const booking = await Booking.findOne({ ticketCode: code }).populate("user", "name email");
    if (!booking) return res.status(400).json({ message: "Invalid ticket. No booking found for this code" });

    const event = await Event.findById(booking.event).lean();
    const attendee = booking.user ? { name: booking.user.name, email: booking.user.email } : null;

    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "This ticket was cancelled", attendee, ticket: ticketView(booking, event) });
    }
    if (req.body?.ticketId && String(req.body.ticketId) !== String(booking._id)) {
      return res.status(400).json({ message: "Invalid ticket. The ticket id does not match this QR code" });
    }
    if (booking.checkedInAt) {
      return res.status(400).json({
        message: "Already checked in",
        attendee,
        ticket: ticketView(booking, event),
      });
    }

    booking.checkedInAt = new Date();
    await booking.save();
    return res.json({ status: "checked-in", message: "Check-in successful", attendee, ticket: ticketView(booking, event) });
  } catch (error) {
    console.error("Check-in failed:", error.message);
    return res.status(500).json({ message: "Could not check in this ticket" });
  }
});

module.exports = router;
