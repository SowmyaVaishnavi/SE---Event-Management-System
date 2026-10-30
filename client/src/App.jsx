import React, { useState } from "react";
import EventFilters, { EMPTY_FILTERS } from "./components/EventFilters.jsx";
import EventList from "./components/EventList.jsx";
import CreateEvent from "./components/CreateEvent.jsx";
import MyTickets from "./components/MyTickets.jsx";
import CheckIn from "./components/CheckIn.jsx";
import { useEvents } from "./hooks/useEvents.js";
import { hasActiveFilters } from "./lib/filterEvents.js";

// Browse + filter page: EMS-F-008 (browse upcoming events) and EMS-F-009 (filter).
export default function App({ user, onLogout }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [highContrast, setHighContrast] = useState(false);
  const [view, setView] = useState("browse");
  const { events, status, error, retry } = useEvents(filters);
  const active = hasActiveFilters(filters);

  return (
    <div className={highContrast ? "app high-contrast" : "app"}>
      <a className="skip" href="#results">
        Skip to events
      </a>

      <header className="top">
        <div>
          <p className="eyebrow">Event Management System</p>
          <h1>Upcoming events</h1>
        </div>
        <div className="top-actions">
          {user && <span className="who">{user.name} ({user.role})</span>}
          <button
            type="button"
            className="btn btn-secondary"
            aria-pressed={highContrast}
            onClick={() => setHighContrast((v) => !v)}
          >
            High contrast: {highContrast ? "on" : "off"}
          </button>
          {onLogout && (
            <button type="button" className="btn btn-secondary" onClick={onLogout}>
              Log out
            </button>
          )}
        </div>
      </header>

      <nav className="nav" aria-label="Main">
        {[
          ["browse", "Browse events"],
          ...(user?.role === "Organizer" ? [["create", "Create event"]] : []),
          ...(user?.role === "Attendee" ? [["tickets", "My tickets"]] : []),
          ...(user?.role === "Organizer" || user?.role === "Admin" ? [["checkin", "Check-in"]] : []),
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="btn btn-secondary"
            aria-current={view === key ? "page" : undefined}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main>
        {view === "create" && <CreateEvent onCreated={() => { retry(); setView("browse"); }} />}
        {view === "tickets" && <MyTickets />}
        {view === "checkin" && <CheckIn />}
        {view === "browse" && (<>
        <EventFilters filters={filters} onChange={setFilters} onClear={() => setFilters(EMPTY_FILTERS)} />

        <p className="count" aria-live="polite">
          {status === "ready" && `${events.length} event${events.length === 1 ? "" : "s"} found`}
        </p>

        <section id="results" tabIndex={-1} aria-label="Event results">
          <EventList events={events} status={status} error={error} onRetry={retry} filtersActive={active} user={user} onBooked={retry} />
        </section>
        </>)}
      </main>
    </div>
  );
}
