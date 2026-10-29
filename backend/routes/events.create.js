// EMS-F-004 route handlers to merge into the existing /api/events router.
// Keep the project's existing GET/filter handlers; add this POST handler there.
const Event = require("../models/Event");

// Use: router.post("/", createEvent);
async function createEvent(req, res) {
  const { title, description, category } = req.body || {};

  if (
    typeof title !== "string" ||
    typeof description !== "string" ||
    typeof category !== "string" ||
    !title.trim() ||
    !description.trim() ||
    !category.trim()
  ) {
    return res.status(400).json({
      message: "Title, description and category are required.",
    });
  }

  try {
    const event = await Event.create({
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
    });
    return res.status(201).json({ event });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    console.error("EMS-F-004 create event failed:", error);
    return res.status(500).json({ message: "Could not create event." });
  }
}

module.exports = { createEvent };
