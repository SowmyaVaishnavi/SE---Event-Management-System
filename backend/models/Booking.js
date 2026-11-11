// EMS-F-010 / F-011 / F-012 / F-019: one booking = one ticket for one attendee and one event.
const crypto = require("crypto");
const mongoose = require("mongoose");

// Unguessable ticket code, shown as a QR code. No ambiguous characters (0/O, 1/I).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateTicketCode() {
  const bytes = crypto.randomBytes(12);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `EMS-${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    // "pending_payment": seat held while a paid booking is being paid for (EMS-F-013). No working ticket yet.
    status: { type: String, enum: ["pending_payment", "confirmed", "cancelled"], default: "confirmed" },
    holdExpiresAt: { type: Date, default: null },
    ticketCode: { type: String, required: true, unique: true, default: generateTicketCode },
    checkedInAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    // "attendee" (F-012), "event_cancelled" (F-006), "payment_failed" / "payment_expired" (F-013), "refunded" (F-015)
    cancelReason: {
      type: String,
      enum: ["attendee", "event_cancelled", "payment_failed", "payment_expired", "refunded", null],
      default: null,
    },
  },
  { timestamps: true }
);

// Seat counts and the per-event booking lists (EMS-NF-001): count confirmed bookings of one event fast.
bookingSchema.index({ event: 1, status: 1 });

// One active booking per attendee per event (a cancelled one does not block re-booking).
bookingSchema.index(
  { user: 1, event: 1 },
  { unique: true, partialFilterExpression: { status: "confirmed" } }
);

const Booking = mongoose.model("Booking", bookingSchema);
module.exports = Booking;
module.exports.generateTicketCode = generateTicketCode;
