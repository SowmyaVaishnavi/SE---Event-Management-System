// EMS-F-004 / F-005 / F-007: shared input checks for creating and editing events.
// Keep CATEGORIES in sync with client/src/config.js (DEVIATIONS D-07).
const CATEGORIES = ["Technical", "Cultural", "Sports", "Workshop", "Seminar", "Social", "Other"];
const STATUSES = ["draft", "published"];
const PUBLISH_FIELDS = ["capacity", "date", "venue", "price"];

const isBlank = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

// Reads only the fields present in `body`. Returns { data, errors }.
// Used as-is for edits (partial update); createEvent adds its own "required" checks.
function parseEventFields(body = {}) {
  const data = {};
  const errors = [];

  for (const key of ["title", "description", "venue"]) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "string" || !body[key].trim()) errors.push(`${key} cannot be empty`);
    else data[key] = body[key].trim();
  }
  if (data.title && data.title.length > 120) errors.push("title must be at most 120 characters");
  if (data.description && data.description.length > 2000) errors.push("description must be at most 2000 characters");
  if (data.venue && data.venue.length > 200) errors.push("venue must be at most 200 characters");

  if (body.category !== undefined) {
    const match = typeof body.category === "string"
      ? CATEGORIES.find((c) => c.toLowerCase() === body.category.trim().toLowerCase())
      : undefined;
    if (match) data.category = match;
    else errors.push(`category must be one of: ${CATEGORIES.join(", ")}`);
  }

  if (!isBlank(body.capacity)) {
    const n = Number(body.capacity);
    if (Number.isInteger(n) && n >= 1 && n <= 100000) data.capacity = n;
    else errors.push("capacity must be a whole number between 1 and 100000");
  }

  if (!isBlank(body.price)) {
    const n = Number(body.price);
    if (Number.isFinite(n) && n >= 0 && n <= 1000000) data.price = Math.round(n * 100) / 100;
    else errors.push("price must be a number of 0 or more (0 means free)");
  }

  if (!isBlank(body.date)) {
    const d = new Date(body.date);
    if (Number.isNaN(d.getTime())) errors.push("date must be a valid date and time");
    else data.date = d;
  }

  if (body.status !== undefined) {
    if (STATUSES.includes(body.status)) data.status = body.status;
    else errors.push(`status must be one of: ${STATUSES.join(", ")}`);
  }

  return { data, errors };
}

// EMS-F-007: an event can only be published when capacity, date, venue and price are set,
// and the date is still in the future. Returns a list of problems (empty = OK to publish).
function publishProblems(event, now = Date.now()) {
  const problems = PUBLISH_FIELDS.filter((f) => isBlank(event[f])).map((f) => `${f} is required to publish`);
  if (!isBlank(event.date) && new Date(event.date).getTime() <= now) {
    problems.push("date must be in the future to publish");
  }
  return problems;
}

module.exports = { CATEGORIES, STATUSES, PUBLISH_FIELDS, parseEventFields, publishProblems };
