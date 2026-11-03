// /api/audit-logs - Admin only. EMS-SR-005 (auth events appear in the log) and EMS-NF-004 (retrieve event and
// transaction logs, including archived ones, for audit and dispute resolution). Read-only on purpose:
// there is no endpoint to edit or delete a log row. See docs/LOG_RETENTION.md.
//
// GET /api/audit-logs?category=&action=&outcome=&actor=&from=&to=&archived=true|false&limit=&before=
//   -> { logs: [{ id, at, category, action, outcome, actor, actorLabel, role, ip, target, detail, archived }], nextBefore }
// GET /api/audit-logs/status -> { recent, archived, oldest, retentionYears, archiveAfterDays, droppedWrites }
const express = require("express");
const mongoose = require("mongoose");
const { requireAuth, requireRole } = require("../middleware/auth");
const { CATEGORIES, OUTCOMES } = require("../models/AuditLog");
const audit = require("../lib/auditLog");

const router = express.Router();
router.use(requireAuth, requireRole("Admin"));

function parseDate(value) {
  if (value === undefined || value === "") return undefined;
  const d = new Date(String(value));
  return Number.isNaN(+d) ? null : d;
}

router.get("/", async (req, res) => {
  const q = req.query;
  const one = (v) => (typeof v === "string" ? v.trim() : undefined) || undefined;
  const category = one(q.category);
  const outcome = one(q.outcome);
  const action = one(q.action);
  const actor = one(q.actor);
  const from = parseDate(q.from);
  let to = parseDate(q.to);
  const before = parseDate(q.before);
  const limit = q.limit === undefined ? 50 : Number(q.limit);

  const problems = [];
  if (category && !CATEGORIES.includes(category)) problems.push(`category must be one of: ${CATEGORIES.join(", ")}`);
  if (outcome && !OUTCOMES.includes(outcome)) problems.push(`outcome must be one of: ${OUTCOMES.join(", ")}`);
  if (action && !/^[a-z_]{1,60}$/.test(action)) problems.push("action is not valid");
  if (actor && !mongoose.isValidObjectId(actor)) problems.push("actor must be a user id");
  if (from === null || to === null || before === null) problems.push("from, to and before must be valid dates");
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) problems.push("limit must be a whole number from 1 to 200");
  if (problems.length) return res.status(400).json({ message: "Some filters are not valid.", errors: problems });

  // A plain date such as 2026-11-02 for "to" means the whole of that day.
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(String(q.to))) to = new Date(+to + 864e5 - 1);

  try {
    const result = await audit.search({ category, action, outcome, actor, from, to, before, limit, includeArchive: q.archived !== "false" });
    res.json(result);
  } catch (error) {
    console.error("Audit log search failed:", error.message);
    res.status(500).json({ message: "Could not load the audit log" });
  }
});

router.get("/status", async (req, res) => {
  try {
    res.json(await audit.status());
  } catch (error) {
    console.error("Audit log status failed:", error.message);
    res.status(500).json({ message: "Could not load the audit log status" });
  }
});

module.exports = router;
