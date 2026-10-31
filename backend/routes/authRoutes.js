// EMS-F-001 register, EMS-F-002 login, EMS-SR-002 bcrypt (see lib/passwords.js and models/User.js).
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { verifyPassword } = require("../lib/passwords");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const { SIGNUP_ROLES, USERNAME } = User;

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
    const ok = await verifyPassword(password, user?.password);

    if (!user || !ok) {
      return res.status(401).json({ message: "Invalid username/email or password" });
    }

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
