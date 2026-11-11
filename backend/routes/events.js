// /api/events - see docs/API_CONTRACT.md.
// EMS-F-004 / F-007 create, EMS-F-005 edit, EMS-F-006 cancel, EMS-F-008 / F-009 browse and filter.
const express = require("express");
const mongoose = require("mongoose");
const Event = require("../models/Event");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const { requireAuth, requireRole } = require("../middleware/auth");
const { createEvent, toView } = require("./events.create");
const { parseEventFields, publishProblems } = require("../lib/eventFields");
const { notify } = require("../lib/notify");
const audit = require("../lib/auditLog");

const router = express.Router();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// "yyyy-mm-dd" -> Date at the start (or end) of that day, UTC. null if invalid.
function parseDay(value, endOfDay) {
  if (!DAY.test(value)) return null;
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

const param = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

// Confirmed bookings per event, for "seats left" (DEVIATIONS D-10).
async function registeredCounts(ids) {
  if (!ids.length) return new Map();
  const rows = await Booking.aggregate([
    { $match: { event: { $in: ids }, status: "confirmed" } },
    { $group: { _id: "$event", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

// GET /api/events - public browse. Only published, upcoming events (F-008).
// Optional filters (F-009): category, location (venue contains), from / to (yyyy-mm-dd, inclusive).
router.get("/", async (req, res) => {
  const category = param(req.query.category);
  const location = param(req.query.location);
  const fromRaw = param(req.query.from);
  const toRaw = param(req.query.to);

  const from = fromRaw ? parseDay(fromRaw, false) : null;
  const to = toRaw ? parseDay(toRaw, true) : null;
  if ((fromRaw && !from) || (toRaw && !to)) {
    return res.status(400).json({ message: "from and to must be dates in yyyy-mm-dd format" });
  }
  if (from && to && from > to) {
    return res.status(400).json({ message: "from must be on or before to" });
  }

  const now = new Date();
  const query = { status: "published", date: { $gte: from && from > now ? from : now } };
  if (to) query.date.$lte = to;
  if (category) query.category = new RegExp(`^${escapeRegex(category)}$`, "i");
  if (location) query.venue = new RegExp(escapeRegex(location), "i");

  try {
    const docs = await Event.find(query).sort({ date: 1 }).lean();
    const counts = await registeredCounts(docs.map((d) => d._id));
    res.json({ events: docs.map((d) => toView(d, counts.get(String(d._id)) ?? 0)) });
  } catch (error) {
    console.error("List events failed:", error.message);
    res.status(500).json({ message: "Could not load events." });
  }
});

// GET /api/events/mine - the organizer's own events, drafts included (Admin: every event).
router.get("/mine", requireAuth, requireRole("Organizer"), async (req, res) => {
  try {
    const query = req.user.role === "Admin" ? {} : { organizer: req.user.id };
    const docs = await Event.find(query).sort({ date: 1, createdAt: -1 }).lean();
    const counts = await registeredCounts(docs.map((d) => d._id));
    res.json({ events: docs.map((d) => toView(d, counts.get(String(d._id)) ?? 0)) });
  } catch (error) {
    console.error("List my events failed:", error.message);
    res.status(500).json({ message: "Could not load your events." });
  }
});

// EMS-F-021: View the current confirmed registrations for an event.
router.get("/:id/registrations", requireAuth, requireRole("Organizer"), async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ message: "Event not found" });
  }

  try {
    const event = await Event.findById(id).lean();

    if (!event || event.status === "draft") {
      return res.status(404).json({ message: "Event not found" });
    }

    if (req.user.role !== "Admin" && String(event.organizer) !== String(req.user.id)) {
      return res.status(403).json({ message: "You can only view registrations for your own events" });
    }

    const bookings = await Booking.find({
      event: event._id,
      status: "confirmed"
    })
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      eventId: String(event._id),
      eventTitle: event.title,
      totalRegistrations: bookings.length,
      registrations: bookings.map((booking) => ({
        registrationId: String(booking._id),
        attendeeName: booking.user?.name || "Unknown attendee",
        attendeeEmail: booking.user?.email || "",
        bookedAt: booking.createdAt,
        checkedIn: Boolean(booking.checkedInAt)
      }))
    });
  } catch (error) {
    console.error("Get event registrations failed:", error);
    return res.status(500).json({ message: "Could not load event registrations." });
  }
});
// GET /api/events/:id - one event (used by booking). Drafts are not public.
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ message: "Event not found" });
  try {
    const event = await Event.findById(id).lean();
    if (!event || event.status === "draft") return res.status(404).json({ message: "Event not found" });
    const counts = await registeredCounts([event._id]);
    res.json(toView(event, counts.get(String(event._id)) ?? 0));
  } catch (error) {
    console.error("Get event failed:", error.message);
    res.status(500).json({ message: "Could not load the event." });
  }
});

// POST /api/events (EMS-F-004, F-007) - Organizer or Admin only (SAD 4.3)
router.post("/", requireAuth, requireRole("Organizer", "Admin"), createEvent);

// PUT /api/events/:id (EMS-F-005, F-007) - the organizer who created the event, or an Admin.
// Send only the fields to change. The saved event is returned so the UI can show it right away.
router.put("/:id", requireAuth, requireRole("Organizer"), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ message: "Event not found" });

  const { data, errors } = parseEventFields(req.body || {});
  if (errors.length) return res.status(400).json({ message: "Some details are not valid.", errors });
  if (!Object.keys(data).length) return res.status(400).json({ message: "Nothing to update." });

  try {
    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (req.user.role !== "Admin" && String(event.organizer) !== String(req.user.id)) {
      return res.status(403).json({ message: "You can only edit events you created" });
    }
    if (event.status === "cancelled") {
      return res.status(409).json({ message: "A cancelled event cannot be edited" });
    }

    const booked = (await registeredCounts([event._id])).get(String(event._id)) ?? 0;
    if (data.capacity !== undefined && data.capacity < booked) {
      return res.status(400).json({ message: `Capacity cannot be lower than the ${booked} seats already booked.` });
    }
    if (data.status === "draft" && event.status === "published" && booked > 0) {
      return res.status(409).json({ message: "This event already has bookings, so it cannot go back to draft." });
    }

    const merged = { ...event.toObject(), ...data };
    if (merged.status === "published") {
      // A past date is only a problem when it is being set now, or the event is being published now.
      const problems = publishProblems(merged).filter((p) =>
        !p.startsWith("date must be in the future") || data.date !== undefined || event.status !== "published");
      if (problems.length) {
        return res.status(400).json({ message: "Set capacity, a future date, venue and price before publishing.", errors: problems });
      }
    }

    event.set(data);
    await event.save();
    audit.record(req, { category: "event", action: "event_updated", target: `event:${event._id}`, detail: { changed: Object.keys(data), status: event.status } });
    return res.json({ message: "Event updated", event: toView(event, booked) });
  } catch (error) {
    if (error.name === "ValidationError") return res.status(400).json({ message: error.message });
    console.error("EMS-F-005 edit event failed:", error);
    return res.status(500).json({ message: "Could not update the event." });
  }
});

// POST /api/events/:id/cancel (EMS-F-006, SAD 4.3) - the event's organizer or an Admin.
// Body (optional): { reason }. Marks the event cancelled, cancels its bookings (tickets stop working)
// and sends a cancellation alert to everyone who booked. Paid bookings are then refunded by an Admin (F-015).
router.post("/:id/cancel", requireAuth, requireRole("Organizer"), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ message: "Event not found" });
  const rawReason = req.body?.reason;
  if (rawReason !== undefined && (typeof rawReason !== "string" || rawReason.length > 500)) {
    return res.status(400).json({ message: "reason must be text of at most 500 characters" });
  }
  const reason = (rawReason || "").trim();

  try {
    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (req.user.role !== "Admin" && String(event.organizer) !== String(req.user.id)) {
      return res.status(403).json({ message: "You can only cancel events you created" });
    }
    if (event.status === "cancelled") {
      return res.status(409).json({ message: "This event is already cancelled" });
    }
    if (event.date && new Date(event.date).getTime() < Date.now()) {
      return res.status(409).json({ message: "This event has already started, so it cannot be cancelled" });
    }

    event.status = "cancelled";
    event.cancelledAt = new Date();
    event.cancelReason = reason;
    await event.save({ validateBeforeSave: false });

    const active = await Booking.find({ event: event._id, status: { $ne: "cancelled" } }, { user: 1 }).lean();
    await Booking.updateMany(
      { event: event._id, status: { $ne: "cancelled" } },
      { $set: { status: "cancelled", cancelledAt: event.cancelledAt, cancelReason: "event_cancelled" } }
    );
    // Unfinished payments for this event can no longer complete (F-013); paid ones wait for an Admin refund (F-015).
    await Payment.updateMany({ event: event._id, status: "created" }, { $set: { status: "failed", failureReason: "Event cancelled" } });

    const when = event.date ? ` on ${new Date(event.date).toUTCString()}` : "";
    const notified = await notify(active.map((b) => b.user), {
      type: "event_cancelled",
      title: `Cancelled: ${event.title}`,
      message:
        `"${event.title}"${when} has been cancelled by the organizer.` +
        (reason ? ` Reason: ${reason}.` : "") +
        " Your ticket is no longer valid. If you paid, your refund will be processed and you will be told when it is done.",
      event: event._id,
    });

    audit.record(req, { category: "event", action: "event_cancelled", target: `event:${event._id}`, detail: { bookingsCancelled: active.length, notified, hasReason: Boolean(reason) } });

    return res.json({
      status: "cancelled",
      message: `Event cancelled. ${notified} attendee${notified === 1 ? " was" : "s were"} alerted.`,
      bookingsCancelled: active.length,
      notified,
      event: toView(event, 0),
    });
  } catch (error) {
    console.error("EMS-F-006 cancel event failed:", error);
    return res.status(500).json({ message: "Could not cancel the event." });
  }
});

module.exports = router;
