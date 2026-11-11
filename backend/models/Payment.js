// EMS-F-013 payment, F-014 receipt, F-015 refund. One payment per paid booking.
// EMS-SR-003: only gateway references and the amount are stored, never card details.
// `strict: "throw"` makes any attempt to save an unknown field (e.g. a card number) fail loudly.
const crypto = require("crypto");
const mongoose = require("mongoose");

// Receipt number shown to the attendee, e.g. RCPT-20261101-7KQ2M9 (F-014).
function generateReceiptNumber(date = new Date()) {
  const day = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `RCPT-${day}-${crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6)}`;
}

const paymentSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    // Whole paise (INR x 100) so no rounding errors.
    amountPaise: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "INR" },
    provider: { type: String, enum: ["sandbox", "razorpay"], required: true },
    providerOrderId: { type: String, required: true, index: true },
    providerPaymentId: { type: String, default: null },
    status: { type: String, enum: ["created", "paid", "failed", "refunded"], default: "created", index: true },
    failureReason: { type: String, default: "" },
    paidAt: { type: Date, default: null },
    receiptNumber: { type: String, default: undefined },
    // Paid after the seat hold ran out (or the event was cancelled): money taken but no seat, so refund it.
    refundDue: { type: Boolean, default: false },
    refund: {
      providerRefundId: { type: String, default: null },
      refundedAt: { type: Date, default: null },
      refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, default: "" },
    },
  },
  { timestamps: true, strict: "throw" }
);

paymentSchema.index({ receiptNumber: 1 }, { unique: true, partialFilterExpression: { receiptNumber: { $type: "string" } } });

const Payment = mongoose.model("Payment", paymentSchema);
module.exports = Payment;
module.exports.generateReceiptNumber = generateReceiptNumber;
