// EMS-F-003: Admin accounts cannot be self-registered. Create (or promote) one from the server:
//   npm run create-admin -- <email> <name> [username]
// The password is read from the ADMIN_PASSWORD environment variable so it never lands in shell history.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const User = require("../models/User");

async function main() {
  const [email, name, username] = process.argv.slice(2);
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !name || !password || password.length < 8) {
    console.error("Usage: ADMIN_PASSWORD=<8+ chars> npm run create-admin -- <email> <name> [username]");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  let user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    user.role = "Admin";
    user.password = password;
  } else {
    user = new User({ email, name, password, role: "Admin", ...(username ? { username } : {}) });
  }
  await user.save(); // the User model hashes the password (EMS-SR-002)
  console.log(`Admin ready: ${user.email}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("create-admin failed:", error.message);
  process.exit(1);
});
