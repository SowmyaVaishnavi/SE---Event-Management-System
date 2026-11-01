// EMS-F-004 create event, EMS-F-007 capacity / date / venue / price.
// SAD 4.3: POST /api/events -> 201 { eventId, status }. The full event is also returned for the UI.
const Event = require("../models/Event");
const { parseEventFields, publishProblems } = require("../lib/eventFields");

// Use: router.post("/", requireAuth, requireRole("Organizer"), createEvent);
async function createEvent(req, res) {
  const body = req.body || {};
  const { data, errors } = parseEventFields(body);

  for (const key of ["title", "description", "category"]) {
    if (body[key] === undefined) errors.push(`${key} is required`);
  }
  if (errors.length) {
    return res.status(400).json({ message: "Title, description and category are required.", errors });
  }

  data.status = data.status || "published";
  if (data.status === "published") {
    const problems = publishProblems(data);
    if (problems.length) {
      return res.status(400).json({
        message: "Set capacity, a future date, venue and price before publishing (or save as a draft).",
        errors: problems,
      });
    }
  }

  try {
    const event = await Event.create({ ...data, organizer: req.user?.id });
    return res.status(201).json({ eventId: event._id, status: event.status, event: toView(event) });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    console.error("EMS-F-004 create event failed:", error);
    return res.status(500).json({ message: "Could not create event." });
  }
}

// API_CONTRACT.md event shape: eventId plus the stored fields.
function toView(event, registeredCount) {
  const e = typeof event.toObject === "function" ? event.toObject() : event;
  const view = {
    eventId: e._id,
    _id: e._id,
    title: e.title,
    description: e.description,
    category: e.category,
    capacity: e.capacity ?? null,
    date: e.date ?? null,
    venue: e.venue ?? null,
    price: e.price ?? 0,
    status: e.status,
    organizer: e.organizer ?? null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
  if (registeredCount !== undefined) view.registeredCount = registeredCount;
  return view;
}

module.exports = { createEvent, toView };
