// EMS-F-017: send each booked attendee one reminder before their event starts (default 24 hours before).
// startReminderSchedule() runs sendDueReminders() on an interval; a reminder is never sent twice,
// because an existing "event_reminder" notification for that user + event is treated as already sent.
//
// REMINDER_HOURS (default 24): how long before the event the reminder goes out.
// REMINDER_INTERVAL_MINUTES (default 15): how often the server checks (0 = do not run the job).
const Event = require("../models/Event");
const Booking = require("../models/Booking");
const Notification = require("../models/Notification");
const { notify } = require("./notify");

const HOUR = 3600 * 1000;

function reminderHours(env = process.env) {
  const n = Number(env.REMINDER_HOURS);
  return Number.isFinite(n) && n > 0 ? n : 24;
}

// Returns the number of reminders created. Never throws.
async function sendDueReminders({ now = new Date(), hours = reminderHours(), notifyImpl = notify } = {}) {
  try {
    const until = new Date(now.getTime() + hours * HOUR);
    const events = await Event.find({ status: "published", date: { $gt: now, $lte: until } }).lean();
    if (!events.length) return 0;

    const eventIds = events.map((e) => e._id);
    const bookings = await Booking.find({ event: { $in: eventIds }, status: "confirmed" }, { user: 1, event: 1 }).lean();
    if (!bookings.length) return 0;

    const already = await Notification.find({ type: "event_reminder", event: { $in: eventIds } }, { user: 1, event: 1 }).lean();
    const sent = new Set(already.map((n) => `${n.event}:${n.user}`));

    let total = 0;
    for (const event of events) {
      const users = bookings
        .filter((b) => String(b.event) === String(event._id) && !sent.has(`${b.event}:${b.user}`))
        .map((b) => b.user);
      if (!users.length) continue;
      const where = event.venue ? ` at ${event.venue}` : "";
      total += await notifyImpl(users, {
        type: "event_reminder",
        title: `Reminder: ${event.title}`,
        message: `"${event.title}" starts on ${new Date(event.date).toUTCString()}${where}. Bring your ticket from My tickets.`,
        event: event._id,
      });
    }
    return total;
  } catch (error) {
    console.error("Send reminders failed:", error.message);
    return 0;
  }
}

function startReminderSchedule(env = process.env) {
  const minutes = env.REMINDER_INTERVAL_MINUTES === undefined ? 15 : Number(env.REMINDER_INTERVAL_MINUTES);
  if (!(minutes > 0)) return null;
  const timer = setInterval(() => sendDueReminders(), minutes * 60000);
  timer.unref();
  sendDueReminders();
  return timer;
}

module.exports = { sendDueReminders, startReminderSchedule, reminderHours };