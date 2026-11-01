// EMS-SR-002: passwords are only ever stored as salted bcrypt hashes.
const bcrypt = require("bcryptjs");

// Cost factor 12 (~250 ms per hash). Can be lowered in tests with BCRYPT_ROUNDS.
const ROUNDS = Math.min(Math.max(Number(process.env.BCRYPT_ROUNDS) || 12, 4), 15);
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

const isBcryptHash = (value) => typeof value === "string" && BCRYPT_HASH.test(value);
const hashPassword = (plain) => bcrypt.hash(plain, ROUNDS);

// Compared against when the user does not exist, so a wrong email and a wrong
// password take the same time and cannot be told apart.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", ROUNDS);

async function verifyPassword(plain, hash) {
  if (typeof plain !== "string") return false;
  const ok = await bcrypt.compare(plain, isBcryptHash(hash) ? hash : DUMMY_HASH);
  return ok && isBcryptHash(hash);
}

module.exports = { ROUNDS, isBcryptHash, hashPassword, verifyPassword };
