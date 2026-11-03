// EMS-NF-004 / TC-OPS-01: move old audit-log rows to the archive collection now (the server also does this
// every day by itself). Rows are NOT deleted: they stay in the archive until their 2-year retention ends.
//   npm run logs:archive              rows older than LOG_ARCHIVE_AFTER_DAYS (default 90)
//   npm run logs:archive -- --days 30
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const audit = require("../lib/auditLog");

async function main() {
  const i = process.argv.indexOf("--days");
  const days = i > -1 ? Number(process.argv[i + 1]) : undefined;
  if (i > -1 && !(days >= 0)) throw new Error("--days needs a number");

  await mongoose.connect(process.env.MONGO_URI);
  const { moved, cutoff } = await audit.archiveOldLogs(days === undefined ? {} : { olderThanDays: days });
  const s = await audit.status();
  console.log(`Archived ${moved} rows older than ${cutoff.toISOString()}`);
  console.log(`Recent: ${s.recent}, archived: ${s.archived}, oldest row: ${s.oldest ? new Date(s.oldest).toISOString() : "none"}`);
  console.log(`Rows are kept ${s.retentionYears} years from the day they were written.`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Archive failed:", error.message);
  process.exit(1);
});
