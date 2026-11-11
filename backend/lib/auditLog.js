// Audit log service: EMS-SR-005 (log authentication events) and EMS-NF-004 (keep event and transaction logs 2+ years).
//
//   record(req, { category, action, outcome, actor, actorLabel, target, detail })
//       Adds one row. Never throws and is not awaited by routes, so a logging problem cannot break a booking or
//       a login and the API stays fast (EMS-NF-001). Passwords, tokens and card data are stripped (SAD 4.4).
//   archiveOldLogs()   moves rows older than ARCHIVE_AFTER_DAYS to the archive collection (run daily, see below).
//   search(filters)    reads recent AND archived rows, newest first (Admin screen and dispute resolution).
//
// Settings (.env): LOG_RETENTION_YEARS (default 2, never below 2), LOG_ARCHIVE_AFTER_DAYS (default 90),
// LOG_ARCHIVE_INTERVAL_HOURS (default 24, 0 = do not schedule). See docs/LOG_RETENTION.md.
const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");
const { AuditLogArchive } = AuditLog;
const { findCardData } = require("./cardData");

const MIN_RETENTION_YEARS = 2;
const SECRET_KEY = /pass(word)?|token|secret|authorization|cookie|signature|card|cvv|cvc|\bpan\b/i;

const positiveInt = (value, fallback) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const retentionYears = () => Math.max(MIN_RETENTION_YEARS, positiveInt(process.env.LOG_RETENTION_YEARS, MIN_RETENTION_YEARS));
const archiveAfterDays = () => positiveInt(process.env.LOG_ARCHIVE_AFTER_DAYS, 90);

// Calendar years, so a row is kept at least 730 days (731 across a leap day), never less.
function retainUntilFor(date = new Date(), years = retentionYears()) {
  const out = new Date(date);
  out.setUTCFullYear(out.getUTCFullYear() + years);
  return out;
}

// Copies `detail` without anything that looks like a secret or a card number; keeps it small.
function sanitize(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (findCardData({ v: value }).length) return "[removed]";
    return value.length > 300 ? `${value.slice(0, 300)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value;
  if (depth >= 3) return "[too deep]";
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  if (typeof value === "object") {
    if (typeof value.toHexString === "function") return String(value);
    const out = {};
    for (const [key, v] of Object.entries(value).slice(0, 30)) {
      out[key] = SECRET_KEY.test(key) ? "[removed]" : sanitize(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

// Only keep a typed login name if it looks like one: people sometimes paste a password into that box.
const labelOf = (raw) => (typeof raw === "string" && /^[a-z0-9._@+-]{1,100}$/i.test(raw.trim()) ? raw.trim().toLowerCase() : raw ? "[not a valid username]" : "");

let dropped = 0;
async function defaultWriter(doc) {
  if (mongoose.connection.readyState !== 1) {
    dropped += 1; // database is down: nothing can be stored (a real outage also stops bookings)
    return;
  }
  await AuditLog.create(doc);
}
let writer = defaultWriter;
const setWriter = (fn) => { writer = fn || defaultWriter; };

function record(req, entry = {}) {
  let doc;
  try {
    const now = new Date();
    doc = {
      category: entry.category,
      action: entry.action,
      outcome: entry.outcome || "success",
      actor: entry.actor ?? req?.user?.id ?? null,
      actorLabel: labelOf(entry.actorLabel),
      role: entry.role ?? req?.user?.role ?? "",
      ip: String(req?.ip || "").slice(0, 64),
      target: String(entry.target || "").slice(0, 100),
      detail: entry.detail === undefined ? undefined : sanitize(entry.detail),
      occurredAt: now,
      retainUntil: retainUntilFor(now),
    };
  } catch {
    return Promise.resolve();
  }
  return Promise.resolve()
    .then(() => writer(doc))
    .catch((error) => console.error("Audit log write failed:", error.message));
}

// ---- EMS-NF-004: archive and retrieval ----

// Moves rows older than the cutoff from the recent collection to the archive collection, in small batches.
// Safe to run again at any time: a row already in the archive is not copied twice, and a row is removed from
// the recent collection only after it is confirmed to be in the archive.
async function archiveOldLogs({ olderThanDays = archiveAfterDays(), now = new Date(), batchSize = 500 } = {}) {
  const cutoff = new Date(+now - olderThanDays * 864e5);
  let moved = 0;
  for (;;) {
    const rows = await AuditLog.find({ occurredAt: { $lt: cutoff } }).sort({ occurredAt: 1 }).limit(batchSize).lean();
    if (!rows.length) break;
    const stamped = rows.map((r) => ({ ...r, archivedAt: now }));
    try {
      await AuditLogArchive.insertMany(stamped, { ordered: false });
    } catch (error) {
      if (error.code !== 11000 && !error.writeErrors?.every((e) => e.code === 11000)) throw error; // duplicates are fine
    }
    const ids = rows.map((r) => r._id);
    const safe = (await AuditLogArchive.find({ _id: { $in: ids } }, { _id: 1 }).lean()).map((r) => String(r._id));
    await AuditLog.deleteMany({ _id: { $in: ids.filter((id) => safe.includes(String(id))) } });
    moved += safe.length;
    if (safe.length < rows.length) break; // something did not reach the archive: stop, try again next run
  }
  return { moved, cutoff };
}

function startArchiveSchedule() {
  const hours = Number(process.env.LOG_ARCHIVE_INTERVAL_HOURS ?? 24);
  if (!(hours > 0)) return null;
  const run = () => archiveOldLogs().then((r) => r.moved && console.log(`Audit log archive: moved ${r.moved} rows`)).catch((e) => console.error("Audit log archive failed:", e.message));
  const first = setTimeout(run, 30 * 1000);
  const timer = setInterval(run, hours * 3600 * 1000);
  first.unref?.();
  timer.unref?.();
  return () => { clearTimeout(first); clearInterval(timer); };
}

const view = (row, archived) => ({
  id: row._id,
  at: row.occurredAt,
  category: row.category,
  action: row.action,
  outcome: row.outcome,
  actor: row.actor ?? null,
  actorLabel: row.actorLabel || "",
  role: row.role || "",
  ip: row.ip || "",
  target: row.target || "",
  detail: row.detail ?? null,
  archived,
});

// filters: { category, action, outcome, actor, from, to, includeArchive = true, limit = 50, before }
// `before` is the nextBefore value of the previous page (paging, newest first).
async function search({ category, action, outcome, actor, from, to, includeArchive = true, limit = 50, before } = {}) {
  const filter = {};
  if (category) filter.category = category;
  if (action) filter.action = action;
  if (outcome) filter.outcome = outcome;
  if (actor) filter.actor = actor;
  if (from || to) filter.occurredAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  if (before) filter.occurredAt = { ...(filter.occurredAt || {}), $lt: before };

  const take = Math.min(200, Math.max(1, limit)) + 1;
  const [recent, old] = await Promise.all([
    AuditLog.find(filter).sort({ occurredAt: -1 }).limit(take).lean(),
    includeArchive ? AuditLogArchive.find(filter).sort({ occurredAt: -1 }).limit(take).lean() : [],
  ]);
  const merged = [...recent.map((r) => view(r, false)), ...old.map((r) => view(r, true))]
    .sort((a, b) => +new Date(b.at) - +new Date(a.at));
  const page = merged.slice(0, take - 1);
  return { logs: page, nextBefore: merged.length >= take ? page[page.length - 1].at : null };
}

async function status() {
  const [recent, archived, oldestRecent, oldestArchived] = await Promise.all([
    AuditLog.countDocuments({}),
    AuditLogArchive.countDocuments({}),
    AuditLog.findOne({}).sort({ occurredAt: 1 }).lean(),
    AuditLogArchive.findOne({}).sort({ occurredAt: 1 }).lean(),
  ]);
  const oldest = [oldestRecent?.occurredAt, oldestArchived?.occurredAt].filter(Boolean).sort((a, b) => +new Date(a) - +new Date(b))[0] ?? null;
  return { recent, archived, oldest, retentionYears: retentionYears(), archiveAfterDays: archiveAfterDays(), droppedWrites: dropped };
}

module.exports = { record, search, status, archiveOldLogs, startArchiveSchedule, retainUntilFor, retentionYears, sanitize, setWriter, MIN_RETENTION_YEARS };
