// EMS-F-001..003: user accounts. Roles follow DEVIATIONS D-06 (Attendee, Organizer, Admin).
const mongoose = require("mongoose");
const { isBcryptHash, hashPassword } = require("../lib/passwords");

const ROLES = ["Attendee", "Organizer", "Admin"];
// Roles a person can pick when signing up. Admin accounts are made with scripts/create-admin.js.
const SIGNUP_ROLES = ["Attendee", "Organizer"];
const USERNAME = /^[a-z0-9._-]{3,30}$/;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    // EMS-F-002 says "username and password". Optional; login also accepts the email.
    username: {
      type: String,
      lowercase: true,
      trim: true,
      match: USERNAME
    },

    password: {
      type: String,
      required: true,
      select: false
    },

    role: {
      type: String,
      enum: ROLES,
      required: true
    },

    // EMS-SR-005: wrong passwords in a row, and when the lock ends (see lib/lockout.js).
    failedLoginAttempts: { type: Number, default: 0, min: 0 },
    lockUntil: { type: Date, default: null }
  },
  { timestamps: true }
);

userSchema.index({ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: "string" } } });

// EMS-SR-002: hash on every save where the password changed, so no code path can store plaintext.
userSchema.pre("save", async function () {
  if (this.isModified("password") && !isBcryptHash(this.password)) {
    this.password = await hashPassword(this.password);
  }
});

// Never send the hash to a client, even if a query selected it.
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.failedLoginAttempts;
    delete ret.lockUntil;
    return ret;
  }
});

module.exports = mongoose.model("User", userSchema);
module.exports.ROLES = ROLES;
module.exports.SIGNUP_ROLES = SIGNUP_ROLES;
module.exports.USERNAME = USERNAME;
