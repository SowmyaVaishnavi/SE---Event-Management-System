// In-app notifications (alerts) for one user. Used by EMS-F-006 (event cancelled) and
// EMS-F-015 (refund done); EMS-F-016..018 can reuse lib/notify.js for their messages.
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ["event_cancelled", "payment_received", "refund_completed", "booking_confirmed", "event_reminder"],
    },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 2000 },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", default: null },
    readAt: { type: Date, default: null },
    // Email delivery through lib/notify.js: "sent", "failed" or "skipped" (no email provider configured).
    email: { status: { type: String, default: "skipped" }, attempts: { type: Number, default: 0 }, error: String },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
