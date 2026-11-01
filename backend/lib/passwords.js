// EMS-SR-002: passwords are only ever stored as salted bcrypt hashes.
// EMS-NF-001: bcrypt is slow on purpose (~250 ms per hash), so it runs on a small pool of worker
// threads (lib/bcryptWorker.js). Logins then use spare CPU cores instead of blocking every other request.
const os = require("os");
const path = require("path");
const { Worker } = require("worker_threads");
const bcrypt = require("bcryptjs");

// Cost factor 12 (~250 ms per hash). Can be lowered in tests with BCRYPT_ROUNDS.
const ROUNDS = Math.min(Math.max(Number(process.env.BCRYPT_ROUNDS) || 12, 4), 15);
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
// One thread per spare core, at most 8 by default (BCRYPT_THREADS to change). Each thread does ~4 logins/s.
const POOL_SIZE = Math.max(1, Math.min(Number(process.env.BCRYPT_THREADS) || 8, os.availableParallelism() - 1));

const isBcryptHash = (value) => typeof value === "string" && BCRYPT_HASH.test(value);

const workers = [];
const pending = new Map();
let nextId = 0;
let turn = 0;
let poolBroken = false;

function startWorker() {
  const worker = new Worker(path.join(__dirname, "bcryptWorker.js"));
  worker.busy = 0;
  worker.unref(); // an idle pool must not keep scripts and tests alive
  worker.on("message", ({ id, result, error }) => {
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    if (--worker.busy === 0) worker.unref();
    error ? job.reject(new Error(error)) : job.resolve(result);
  });
  worker.on("error", (error) => {
    // Fail the jobs on this worker and fall back to the main thread from now on.
    console.error("bcrypt worker failed:", error.message);
    poolBroken = true;
    for (const [id, job] of pending) if (job.worker === worker) { pending.delete(id); job.reject(error); }
  });
  return worker;
}

function run(op, plain, hash) {
  if (poolBroken) return op === "hash" ? bcrypt.hash(plain, ROUNDS) : bcrypt.compare(plain, hash);
  if (workers.length < POOL_SIZE) workers.push(startWorker());
  const worker = workers[turn++ % workers.length];
  const id = ++nextId;
  if (worker.busy++ === 0) worker.ref(); // keep the process alive until the answer arrives
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, worker });
    worker.postMessage({ id, op, plain, hash, rounds: ROUNDS });
  });
}

const hashPassword = (plain) => run("hash", plain);

// Compared against when the user does not exist, so a wrong email and a wrong
// password take the same time and cannot be told apart.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", ROUNDS);

async function verifyPassword(plain, hash) {
  if (typeof plain !== "string") return false;
  const ok = await run("compare", plain, isBcryptHash(hash) ? hash : DUMMY_HASH);
  return ok && isBcryptHash(hash);
}

module.exports = { ROUNDS, POOL_SIZE, isBcryptHash, hashPassword, verifyPassword };
