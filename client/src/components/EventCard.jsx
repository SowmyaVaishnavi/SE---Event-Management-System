import React, { useState } from "react";
import { bookEvent } from "../api/bookings.js";
import { seatsLeft } from "../lib/filterEvents.js";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });

function formatPrice(price) {
  if (price === 0 || price == null) return "Free";
  return `₹${Number(price).toLocaleString("en-IN")}`;
}

/** One event in the browse list (EMS-F-008). */
export default function EventCard({ event, user, onBooked }) {
  const [booking, setBooking] = useState({ state: "idle", message: "" });
  const start = new Date(event.date);
  const left = seatsLeft(event);
  const full = left === 0;
  const canBook = user?.role === "Attendee";

  async function handleBook() {
    setBooking({ state: "saving", message: "" });
    try {
      await bookEvent(event.eventId);
      setBooking({ state: "done", message: "Booked! Your ticket is under My tickets." });
      onBooked?.();
    } catch (err) {
      setBooking({ state: "error", message: err.message });
    }
  }

  return (
    <li className="card">
      <article aria-labelledby={`title-${event.eventId}`}>
        <div className="card-top">
          <span className="chip">{event.category}</span>
          <span className={`price ${event.price ? "" : "free"}`}>{formatPrice(event.price)}</span>
        </div>

        <h2 id={`title-${event.eventId}`}>{event.title}</h2>
        {event.description && <p className="desc">{event.description}</p>}

        <dl className="meta">
          <div>
            <dt>Date</dt>
            <dd>
              <time dateTime={start.toISOString()}>
                {dateFmt.format(start)}, {timeFmt.format(start)}
              </time>
            </dd>
          </div>
          <div>
            <dt>Venue</dt>
            <dd>{event.venue}</dd>
          </div>
          {left !== null && (
            <div>
              <dt>Availability</dt>
              <dd className={full ? "full" : left <= 10 ? "low" : ""}>
                {full ? "Event full" : `${left} seat${left === 1 ? "" : "s"} left`}
              </dd>
            </div>
          )}
        </dl>

        {canBook && (
          <div className="book">
            <button
              type="button"
              className="btn"
              onClick={handleBook}
              disabled={full || booking.state === "saving" || booking.state === "done"}
              aria-describedby={`book-msg-${event.eventId}`}
            >
              {booking.state === "saving" ? "Booking..." : booking.state === "done" ? "Booked" : full ? "Event full" : "Book a spot"}
            </button>
            <p
              id={`book-msg-${event.eventId}`}
              className={`message ${booking.state === "error" ? "error" : ""}`}
              role={booking.state === "error" ? "alert" : "status"}
            >
              {booking.message}
            </p>
          </div>
        )}
      </article>
    </li>
  );
}
