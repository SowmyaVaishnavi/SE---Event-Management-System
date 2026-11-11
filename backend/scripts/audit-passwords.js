// TC-Sec-02 / EMS-SR-002: DB audit. Fails if any stored password is not a bcrypt hash.
//   npm run audit:passwords
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const User = require("../models/User");
const { isBcryptHash } = require("../lib/passwords");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({}, { email: 1, password: 1 }).lean();
  const bad = users.filter((u) => !isBcryptHash(u.password));
  console.log(`Checked ${users.length} users: ${users.length - bad.length} bcrypt hashes, ${bad.length} not hashed`);
  for (const u of bad) console.log(`  NOT HASHED: ${u.email}`);
  await mongoose.disconnect();
  process.exit(bad.length ? 1 : 0);
}

main().catch((error) => {
  console.error("Password audit failed:", error.message);
  process.exit(1);
});
