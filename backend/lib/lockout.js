// EMS-SR-005: account lockout after repeated failed logins. Pure helpers, easy to test.
//   LOGIN_MAX_ATTEMPTS  failed passwords in a row before the account locks (default 5)
//   LOGIN_LOCK_MINUTES  how long the lock lasts (default 15)
const positiveInt = (value, fallback) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const maxAttempts = () => positiveInt(process.env.LOGIN_MAX_ATTEMPTS, 5);
const lockMinutes = () => positiveInt(process.env.LOGIN_LOCK_MINUTES, 15);

const isLocked = (user, now = Date.now()) => Boolean(user?.lockUntil) && +new Date(user.lockUntil) > now;
const secondsLeft = (user, now = Date.now()) => Math.max(1, Math.ceil((+new Date(user.lockUntil) - now) / 1000));

module.exports = { maxAttempts, lockMinutes, isLocked, secondsLeft };
