// EMS-SR-005 (auth event log) and EMS-NF-004 (event and transaction logs kept for 2+ years).
// One row = one thing that happened. Rows are only ever added; no route edits or deletes them.
// Two collections share this schema (see lib/auditLog.js): "auditlogs" (recent, fast) and
// "auditlogarchive" (older rows moved there by the archive job). Both are kept until `retainUntil`.
// EMS-SR-005 / SAD 4.4: never store passwords, tokens or card data here (lib/auditLog.js strips them).
const mongoose = require("mongoose");

const CATEGORIES = ["auth", "event", "booking", "payment"];
const OUTCOMES = ["success", "failure", "denied"];

function buildSchema() {
  const schema = new mongoose.Schema(
    {
      category: { type: String, enum: CATEGORIES, required: true },
      action: { type: String, required: true, maxlength: 60 },
      outcome: { type: String, enum: OUTCOMES, required: true },
      actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      // The username/email typed at login (failed logins have no actor when the account does not exist).
      actorLabel: { type: String, maxlength: 100, default: "" },
      role: { type: String, maxlength: 20, default: "" },
      ip: { type: String, maxlength: 64, default: "" },
      target: { type: String, maxlength: 100, default: "" },
      detail: { type: mongoose.Schema.Types.Mixed, default: undefined },
      occurredAt: { type: Date, default: Date.now },
      // Earliest date this row may be deleted: occurredAt + 2 years (or more, see LOG_RETENTION_YEARS).
      retainUntil: { type: Date, required: true },
      archivedAt: { type: Date, default: null },
    },
    { versionKey: false }
  );
  schema.index({ occurredAt: -1 });
  schema.index({ category: 1, occurredAt: -1 });
  schema.index({ actor: 1, occurredAt: -1 });
  // MongoDB removes a row by itself only once retainUntil has passed, never earlier.
  schema.index({ retainUntil: 1 }, { expireAfterSeconds: 0 });
  return schema;
}

const AuditLog = mongoose.model("AuditLog", buildSchema(), "auditlogs");
const AuditLogArchive = mongoose.model("AuditLogArchive", buildSchema(), "auditlogarchive");

module.exports = AuditLog;
module.exports.AuditLogArchive = AuditLogArchive;
module.exports.CATEGORIES = CATEGORIES;
module.exports.OUTCOMES = OUTCOMES;
