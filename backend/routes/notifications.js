// GET /api/notifications/me, POST /api/notifications/:id/read - a user's in-app alerts.
const express = require("express");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  try {
    const docs = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({
      unread: docs.filter((d) => !d.readAt).length,
      notifications: docs.map((d) => ({
        id: d._id,
        type: d.type,
        title: d.title,
        message: d.message,
        eventId: d.event,
        createdAt: d.createdAt,
        readAt: d.readAt,
      })),
    });
  } catch (error) {
    console.error("Load notifications failed:", error.message);
    res.status(500).json({ message: "Could not load your alerts" });
  }
});

router.post("/:id/read", requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Alert not found" });
  try {
    const result = await Notification.updateOne(
      { _id: req.params.id, user: req.user.id, readAt: null },
      { $set: { readAt: new Date() } }
    );
    if (!result.matchedCount) {
      const exists = await Notification.exists({ _id: req.params.id, user: req.user.id });
      if (!exists) return res.status(404).json({ message: "Alert not found" });
    }
    res.json({ message: "Marked as read" });
  } catch (error) {
    console.error("Mark notification read failed:", error.message);
    res.status(500).json({ message: "Could not update the alert" });
  }
});

module.exports = router;
