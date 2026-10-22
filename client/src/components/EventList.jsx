import React from "react";
import EventCard from "./EventCard.jsx";

/** The results area: loading, error, empty and list states (EMS-F-008). */
export default function EventList({ events, status, error, onRetry, filtersActive }) {
  if (status === "error") {
    return (
      <div className="state state-error" role="alert">
        <p>{error}</p>
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  if (status === "loading" && events.length === 0) {
    return (
      <div className="state" role="status">
        <p>Loading events&hellip;</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="state" role="status">
        <p>
          {filtersActive
            ? "No upcoming events match your filters."
            : "There are no upcoming events right now. Please check back soon."}
        </p>
      </div>
    );
  }

  return (
    <ul className={`grid ${status === "loading" ? "is-refreshing" : ""}`} aria-busy={status === "loading"}>
      {events.map((e) => (
        <EventCard key={e.eventId ?? e._id} event={{ ...e, eventId: e.eventId ?? e._id }} />
      ))}
    </ul>
  );
}
