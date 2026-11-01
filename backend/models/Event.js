// EMS-F-004 / F-007: MongoDB schema for events.
// capacity, date, venue and price may be empty on a draft, but a published event needs all of them.
const mongoose = require("mongoose");
const { CATEGORIES, publishProblems } = require("../lib/eventFields");

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, required: true, trim: true, enum: CATEGORIES },
    capacity: { type: Number, min: 1, max: 100000 },
    date: { type: Date, index: true },
    venue: { type: String, trim: true, maxlength: 200 },
    price: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ["draft", "published", "cancelled"], default: "published", index: true },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true }
);

// Safety net for EMS-F-007: the routes check this too, but never store an incomplete published event.
// Only checked when the event becomes published, so editing a past event's text does not fail.
eventSchema.pre("validate", function () {
  if (this.status === "published" && (this.isNew || this.isModified("status") || this.isModified("date"))) {
    const problems = publishProblems(this);
    if (problems.length) this.invalidate("status", problems.join("; "));
  }
});

module.exports = mongoose.model("Event", eventSchema);
