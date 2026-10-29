// EMS-F-004: MongoDB schema for event creation.
const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: {
      type: String,
      required: true,
      trim: true,
      enum: ["Technical", "Cultural", "Sports", "Workshop", "Seminar", "Social", "Other"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);
