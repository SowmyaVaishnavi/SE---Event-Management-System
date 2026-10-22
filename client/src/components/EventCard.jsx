import React from "react";
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
export default function EventCard({ event }) {
  const start = new Date(event.date);
  const left = seatsLeft(event);
  const full = left === 0;

  return (
    <li className="card">
      <article aria-labelledby={`title-${event.eventId}`}>
        <div className="card-top">
          <span className="chip">{event.category}</span>
          <span className={`price ${event.price ? "" : "free"}`}>{formatPrice(event.price)}</span>
        </div>

        <h3 id={`title-${event.eventId}`}>{event.title}</h3>
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
      </article>
    </li>
  );
}
