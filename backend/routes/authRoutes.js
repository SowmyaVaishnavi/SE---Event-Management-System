// EMS-F-001 register, EMS-F-002 login, EMS-SR-002 bcrypt (see lib/passwords.js and models/User.js).
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { verifyPassword } = require("../lib/passwords");
const { requireAuth } = require("../middleware/auth");
const audit = require("../lib/auditLog");
const { maxAttempts, lockMinutes, isLocked, secondsLeft } = require("../lib/lockout");

const router = express.Router();
const { SIGNUP_ROLES, USERNAME } = User;

// EMS-SR-005: 423 Locked (SAD 4.3) with the time left, so the UI can tell the person when to try again.
function lockedResponse(res, user, now = Date.now()) {
  const seconds = secondsLeft(user, now);
  res.set("Retry-After", String(seconds));
  return res.status(423).json({
    message: `Too many failed login attempts. This account is locked for now. Try again in ${Math.ceil(seconds / 60)} minute(s).`,
    retryAfterSeconds: seconds
  });
}

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  username: user.username ?? null,
  role: user.role
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};
    const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      password.length < 8 ||
      password.length > 72 ||
      !SIGNUP_ROLES.includes(role)
    ) {
      return res.status(400).json({
        message: "Enter valid details and a password of 8 to 72 characters"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Enter a valid email address"
      });
    }

    if (username && !USERNAME.test(username)) {
      return res.status(400).json({
        message: "Username must be 3 to 30 characters: letters, numbers, dot, dash or underscore"
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, ...(username ? [{ username }] : [])]
    });

    if (existingUser) {
      audit.record(req, {
        category: "auth", action: "register_rejected", outcome: "failure", actorLabel: normalizedEmail,
        detail: { reason: existingUser.email === normalizedEmail ? "email_taken" : "username_taken" }
      });
      return res.status(409).json({
        message: existingUser.email === normalizedEmail ? "Email already registered" : "Username already taken"
      });
    }

    // The User model hashes the password with bcrypt before it is saved (EMS-SR-002).
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      ...(username ? { username } : {}),
      password,
      role
    });

    audit.record(req, { category: "auth", action: "register_success", outcome: "success", actor: user._id, role: user.role, actorLabel: normalizedEmail });

    res.status(201).json({
      message: "Registration successful",
      user: publicUser(user)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: error.keyPattern?.username ? "Username already taken" : "Email already registered"
      });
    }

    console.error("Registration error:", error.message);

    res.status(500).json({
      message: "Server error"
    });
  }
});

// Body: { username, password } or { email, password }. Either field may hold an email or a username.
router.post("/login", async (req, res) => {
  try {
    const { password } = req.body || {};
    const raw = req.body?.username ?? req.body?.email ?? req.body?.identifier;
    const login = typeof raw === "string" ? raw.trim().toLowerCase() : "";

    if (!login || typeof password !== "string" || !password) {
      return res.status(400).json({ message: "Enter your username or email and password" });
    }

    const user = await User.findOne(login.includes("@") ? { email: login } : { username: login }).select("+password");
    const now = Date.now();

    // A locked account is refused before the password is even checked, so guessing cannot continue.
    if (user && isLocked(user, now)) {
      audit.record(req, { category: "auth", action: "login_blocked", outcome: "denied", actor: user._id, role: user.role, actorLabel: login, detail: { reason: "account_locked" } });
      return lockedResponse(res, user, now);
    }

    const ok = await verifyPassword(password, user?.password);

    if (!user || !ok) {
      if (!user) {
        audit.record(req, { category: "auth", action: "login_failed", outcome: "failure", actorLabel: login, detail: { reason: "unknown_account" } });
        return res.status(401).json({ message: "Invalid username/email or password" });
      }

      // Count the failure in one atomic step so parallel guesses cannot slip past the limit.
      const updated = await User.findOneAndUpdate(
        { _id: user._id },
        { $inc: { failedLoginAttempts: 1 } },
        { returnDocument: "after", projection: { failedLoginAttempts: 1 } }
      );
      const attempts = updated?.failedLoginAttempts ?? 1;

      if (attempts >= maxAttempts()) {
        const lockUntil = new Date(now + lockMinutes() * 60 * 1000);
        await User.updateOne({ _id: user._id }, { $set: { lockUntil, failedLoginAttempts: 0 } });
        audit.record(req, { category: "auth", action: "account_locked", outcome: "denied", actor: user._id, role: user.role, actorLabel: login, detail: { after: attempts, lockMinutes: lockMinutes() } });
        return lockedResponse(res, { lockUntil }, now);
      }

      audit.record(req, { category: "auth", action: "login_failed", outcome: "failure", actor: user._id, role: user.role, actorLabel: login, detail: { reason: "wrong_password", attempts } });
      return res.status(401).json({ message: "Invalid username/email or password" });
    }

    // Right password: forget earlier failures and any lock that has run out.
    if (user.failedLoginAttempts || user.lockUntil) {
      await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockUntil: null } });
    }
    audit.record(req, { category: "auth", action: "login_success", outcome: "success", actor: user._id, role: user.role, actorLabel: login });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: publicUser(user)
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/auth/me - who am I (used by the UI to check a stored token is still valid)
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: "Session expired. Please log in again" });
    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error("Load profile error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
