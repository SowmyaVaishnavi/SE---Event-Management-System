import React, { useEffect, useRef, useState } from "react";
import EventFilters, { EMPTY_FILTERS } from "./components/EventFilters.jsx";
import EventList from "./components/EventList.jsx";
import CreateEvent from "./components/CreateEvent.jsx";
import MyTickets from "./components/MyTickets.jsx";
import CheckIn from "./components/CheckIn.jsx";
import MyEvents from "./components/MyEvents.jsx";
import Alerts from "./components/Alerts.jsx";
import AdminPayments from "./components/AdminPayments.jsx";
import AuditLog from "./components/AuditLog.jsx";
import { useEvents } from "./hooks/useEvents.js";
import { hasActiveFilters } from "./lib/filterEvents.js";

// Browse + filter page: EMS-F-008 (browse upcoming events) and EMS-F-009 (filter).
const VIEW_TITLES = {
  browse: "Upcoming events",
  create: "Create event",
  mine: "My events",
  tickets: "My tickets",
  checkin: "Event check-in",
};

export default function App({ user, onLogout }) {
  const mainRef = useRef(null);
  const firstRender = useRef(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [highContrast, setHighContrast] = useState(false);
  const [view, setView] = useState("browse");

  // WCAG 2.4.2: every view has its own page title. 2.4.3 / 4.1.3: after the person
  // switches view, move focus to the new content so keyboard and screen-reader users land on it.
  useEffect(() => {
    document.title = `${VIEW_TITLES[view]} - EMS`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [view]);
  const { events, status, error, retry } = useEvents(filters);
  const active = hasActiveFilters(filters);

  return (
    <div className={highContrast ? "app high-contrast" : "app"}>
      <a className="skip" href="#main">
        Skip to main content
      </a>

      <header className="top">
        <div>
          <p className="eyebrow">Event Management System</p>
          <h1>{VIEW_TITLES[view]}</h1>
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
          ...(user?.role === "Organizer" || user?.role === "Admin" ? [["create", "Create event"], ["mine", "My events"]] : []),
          ...(user?.role === "Attendee" ? [["tickets", "My tickets"]] : []),
          ...(user?.role === "Organizer" || user?.role === "Admin" ? [["checkin", "Check-in"]] : []),
          ...(user?.role === "Admin" ? [["payments", "Payments"], ["audit", "Audit log"]] : []),
          ["alerts", "Alerts"],
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

      <main id="main" ref={mainRef} tabIndex={-1}>
        {view === "create" && <CreateEvent onCreated={() => { retry(); setView("browse"); }} />}
        {view === "mine" && <MyEvents user={user} onChanged={retry} />}
        {view === "tickets" && <MyTickets user={user} />}
        {view === "checkin" && <CheckIn />}
        {view === "alerts" && <Alerts />}
        {view === "payments" && <AdminPayments />}
        {view === "audit" && <AuditLog />}
        {view === "browse" && (<>
        <EventFilters filters={filters} onChange={setFilters} onClear={() => setFilters(EMPTY_FILTERS)} />

        <p className="count" aria-live="polite">
          {status === "ready" && `${events.length} event${events.length === 1 ? "" : "s"} found`}
        </p>

        <section id="results" tabIndex={-1} aria-label="Event results">
          <EventList events={events} status={status} error={error} onRetry={retry} filtersActive={active} user={user} onBooked={(result) => { retry(); if (result?.status === "pending_payment") setView("tickets"); }} />
        </section>
        </>)}
      </main>
    </div>
  );
}
