// Worker thread for lib/passwords.js: runs bcrypt off the main thread so a burst of logins
// does not stall every other API request (EMS-NF-001).
const { parentPort } = require("worker_threads");
const bcrypt = require("bcryptjs");

parentPort.on("message", async ({ id, op, plain, hash, rounds }) => {
  try {
    const result = op === "hash" ? await bcrypt.hash(plain, rounds) : await bcrypt.compare(plain, hash);
    parentPort.postMessage({ id, result });
  } catch (error) {
    parentPort.postMessage({ id, error: error.message });
  }
});
