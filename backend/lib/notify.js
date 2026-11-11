// Notification Service (SAD 3.2 "Payment & Notification Service").
// Every alert is stored as an in-app notification (shown under "Alerts" in the UI) and, when an email
// webhook is configured, also sent by email with retries (SAD 3.6 "automatic retry on failed sends").
//
// NOTIFY_WEBHOOK_URL: optional HTTPS endpoint of the email provider (e.g. a Mailgun / SendGrid / Brevo
// relay) that accepts POST { to, subject, text }. Without it, alerts are in-app only.
const Notification = require("../models/Notification");
const User = require("../models/User");

const RETRIES = 3;

async function sendEmail(to, subject, text, { fetchImpl = globalThis.fetch, url = process.env.NOTIFY_WEBHOOK_URL } = {}) {
  if (!url) return { status: "skipped", attempts: 0 };
  let lastError = "";
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, text }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return { status: "sent", attempts: attempt };
      lastError = `HTTP ${res.status}`;
    } catch (error) {
      lastError = error.message;
    }
  }
  return { status: "failed", attempts: RETRIES, error: lastError };
}

// notify([userId, ...], { type, title, message, event }) -> number of notifications created.
// Never throws: a notification problem must not undo the cancel / refund that triggered it.
async function notify(userIds, { type, title, message, event = null }, options = {}) {
  const ids = [...new Set(userIds.map(String))];
  if (!ids.length) return 0;
  try {
    const docs = await Notification.insertMany(ids.map((user) => ({ user, type, title, message, event })));
    // Emails go out in the background so the API answers quickly (EMS-NF-001).
    const emailing = (async () => {
      const users = await User.find({ _id: { $in: ids } }, { email: 1 }).lean();
      const emailOf = new Map(users.map((u) => [String(u._id), u.email]));
      for (const doc of docs) {
        const to = emailOf.get(String(doc.user));
        const result = to ? await sendEmail(to, title, message, options) : { status: "skipped", attempts: 0 };
        await Notification.updateOne({ _id: doc._id }, { $set: { email: result } });
      }
    })().catch((error) => console.error("Notification email failed:", error.message));
    if (options.waitForEmail) await emailing;
    return docs.length;
  } catch (error) {
    console.error("Notification failed:", error.message);
    return 0;
  }
}

module.exports = { notify, sendEmail };
