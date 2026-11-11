// Demo data for presenting the system and taking screenshots (docs/DEMO_GUIDE.md).
//   npm run seed:demo
// Creates an Admin, an Organizer, two Attendees (password below) and six upcoming events.
// Event dates are relative to today, so run it on the day of the demo. Safe to re-run: it first removes
// only the records it made before (users with an @ems.demo email, their events, bookings, payments and alerts).
// Needs MongoDB running and MONGO_URI in backend/.env. It does not need the API to be running.
// DO NOT run against production (it refuses when NODE_ENV=production).
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const User = require("../models/User");
const Event = require("../models/Event");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Notification = require("../models/Notification");

// Test password for the demo accounts only. These accounts exist only in the database you seed.
const DEMO_PASSWORD = "Demo-pass-2026";

const PEOPLE = [
  { name: "Admin User", email: "admin@ems.demo", username: "admin", role: "Admin" },
  { name: "Asha Organizer", email: "organizer@ems.demo", username: "organizer", role: "Organizer" },
  { name: "Ravi Attendee", email: "attendee1@ems.demo", username: "ravi", role: "Attendee" },
  { name: "Meera Attendee", email: "attendee2@ems.demo", username: "meera", role: "Attendee" },
];

// [title, description, category, capacity, days from now, venue, price in INR]
const EVENTS = [
  ["AI & Data Science Symposium", "Talks and posters on applied machine learning.", "Seminar", 200, 10, "Main Auditorium, Bangalore", 0],
  ["Inter-College Hackathon 2026", "24-hour build event with mentors.", "Technical", 120, 14, "Lab Block Hall, Mysuru", 0],
  ["Cultural Fest: Music Night", "Live bands and open mic.", "Cultural", 30, 7, "Open Air Theatre, Bangalore", 499.5],
  ["Full-Stack Web Workshop", "Hands-on React and Node.js workshop.", "Workshop", 40, 21, "Seminar Hall 2, Bangalore", 250],
  ["Inter-Department Cricket", "Knockout tournament.", "Sports", 60, 5, "College Ground, Mysuru", 0],
  ["Alumni Meet & Greet", "Meet alumni from every batch.", "Social", 150, 30, "Main Hall, Bangalore", 0],
];

async function removeOldDemoData() {
  const users = await User.find({ email: /@ems\.demo$/ }, { _id: 1 }).lean();
  const userIds = users.map((u) => u._id);
  const events = await Event.find({ organizer: { $in: userIds } }, { _id: 1 }).lean();
  const eventIds = events.map((e) => e._id);
  const mine = { $or: [{ user: { $in: userIds } }, { event: { $in: eventIds } }] };
  await Notification.deleteMany(mine);
  await Payment.deleteMany(mine);
  await Booking.deleteMany(mine);
  await Event.deleteMany({ _id: { $in: eventIds } });
  await User.deleteMany({ _id: { $in: userIds } });
  return { users: userIds.length, events: eventIds.length };
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data with NODE_ENV=production");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing. Copy backend/.env.example to backend/.env first");

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const removed = await removeOldDemoData();
  if (removed.users) console.log(`Removed the previous demo data (${removed.users} users, ${removed.events} events)`);

  const users = {};
  for (const person of PEOPLE) {
    // The User model hashes the password with bcrypt before saving (EMS-SR-002).
    users[person.username] = await User.create({ ...person, password: DEMO_PASSWORD });
  }

  const day = 864e5;
  for (const [title, description, category, capacity, days, venue, price] of EVENTS) {
    await Event.create({
      title, description, category, capacity, venue, price,
      date: new Date(Date.now() + days * day),
      status: "published",
      organizer: users.organizer._id,
    });
  }

  console.log(`Created ${PEOPLE.length} demo users and ${EVENTS.length} upcoming events in ${mongoose.connection.name}.\n`);
  console.log("Role       Username    Email                 Password");
  for (const p of PEOPLE) console.log(`${p.role.padEnd(10)} ${p.username.padEnd(11)} ${p.email.padEnd(21)} ${DEMO_PASSWORD}`);
  console.log("\nEither the username or the email works on the login page. Next: see docs/DEMO_GUIDE.md");
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("seed:demo failed:", error.message);
  process.exit(1);
});
