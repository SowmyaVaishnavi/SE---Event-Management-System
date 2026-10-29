const express = require("express");
const Event = require("../models/Event");
const { createEvent } = require("./events.create");

const router = express.Router();

// GET /api/events (public browse; optional ?category=)
router.get("/", async (req, res) => {
  try {
    const query = {};
    if (typeof req.query.category === "string" && req.query.category.trim()) {
      query.category = new RegExp(`^${req.query.category.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    }
    const docs = await Event.find(query).sort({ createdAt: -1 }).lean();
    res.json({ events: docs.map((d) => ({ ...d, eventId: d._id })) });
  } catch (error) {
    console.error("List events failed:", error.message);
    res.status(500).json({ message: "Could not load events." });
  }
});

// POST /api/events (EMS-F-004)
router.post("/", createEvent);

module.exports = router;
