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
    status: { type: String, enum: ["confirmed", "cancelled"], default: "confirmed" },
    ticketCode: { type: String, required: true, unique: true, default: generateTicketCode },
    checkedInAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One active booking per attendee per event (a cancelled one does not block re-booking).
bookingSchema.index(
  { user: 1, event: 1 },
  { unique: true, partialFilterExpression: { status: "confirmed" } }
);

const Booking = mongoose.model("Booking", bookingSchema);
module.exports = Booking;
module.exports.generateTicketCode = generateTicketCode;
