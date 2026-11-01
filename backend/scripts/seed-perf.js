// Test data for TC-Perf-01 (npm run perf): 200 upcoming events, 200 attendees, ~1,000 bookings.
// Only touches records it created (emails ending @perf.test, titles starting "[perf]"); safe to re-run.
// DO NOT run against production.
//   npm run seed:perf            (add --clean to remove the perf data only)
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const User = require("../models/User");
const Event = require("../models/Event");
const Booking = require("../models/Booking");
const { hashPassword } = require("../lib/passwords");
const { CATEGORIES } = require("../lib/eventFields");

const PASSWORD = "perf-test-password";
const VENUES = ["Main Hall", "Seminar Hall 2", "Open Air Theatre", "Lab Block Hall", "Auditorium Hall"];

async function clean() {
  const users = await User.find({ email: /@perf\.test$/ }, { _id: 1 }).lean();
  const events = await Event.find({ title: /^\[perf\]/ }, { _id: 1 }).lean();
  await Booking.deleteMany({ $or: [{ user: { $in: users.map((u) => u._id) } }, { event: { $in: events.map((e) => e._id) } }] });
  await Event.deleteMany({ _id: { $in: events.map((e) => e._id) } });
  await User.deleteMany({ _id: { $in: users.map((u) => u._id) } });
  return { users: users.length, events: events.length };
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed perf data with NODE_ENV=production");
  await mongoose.connect(process.env.MONGO_URI);
  const removed = await clean();
  if (process.argv.includes("--clean")) {
    console.log(`Removed perf data: ${removed.users} users, ${removed.events} events`);
    return mongoose.disconnect();
  }

  const hash = await hashPassword(PASSWORD); // one hash reused; bcrypt per user would take minutes
  const organizer = await User.create({ name: "Perf Organizer", email: "perf.organizer@perf.test", password: hash, role: "Organizer" });
  const attendees = await User.insertMany(Array.from({ length: 200 }, (_, i) => ({
    name: `Perf Attendee ${i}`, email: `perf.attendee${i}@perf.test`, password: hash, role: "Attendee",
  })));
  const day = 864e5;
  const events = await Event.insertMany(Array.from({ length: 200 }, (_, i) => ({
    title: `[perf] Event ${i}`,
    description: "Load test event",
    category: CATEGORIES[i % CATEGORIES.length],
    capacity: 50 + (i % 5) * 50,
    date: new Date(Date.now() + (1 + (i % 60)) * day),
    venue: VENUES[i % VENUES.length],
    price: 0,
    status: "published",
    organizer: organizer._id,
  })));
  const bookings = [];
  attendees.forEach((a, i) => {
    for (let k = 0; k < 5; k++) bookings.push({ user: a._id, event: events[(i * 7 + k * 31) % events.length]._id, status: "confirmed" });
  });
  await Booking.insertMany(bookings);
  console.log(`Seeded ${attendees.length} attendees, ${events.length} events, ${bookings.length} bookings (password "${PASSWORD}")`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("seed:perf failed:", error.message);
  process.exit(1);
});
