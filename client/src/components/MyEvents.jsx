
import React, { useCallback, useEffect, useState } from "react";
import CreateEvent from "./CreateEvent.jsx";

// EMS-F-005: an organizer's own events (Admin: all events), with an Edit form for each.
// EMS-F-006: Cancel event.
// EMS-F-021: View confirmed registrations for an event.
function authHeaders() {
  const headers = { Accept: "application/json" };
  try {
    const token = localStorage.getItem("ems_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* storage unavailable */
  }
  return headers;
}

function formatDate(iso) {
  if (!iso) return "No date set";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "No date set"
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function exportRegistrationsToCsv(registrations, eventTitle) {
  const headers = [
    "Attendee Name",
    "Email",
    "Booking Date",
    "Check-in Status",
  ];

  const escapeCsv = (value) => {
    let text = String(value ?? "");

    // Prevent spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(text)) {
      text = `'${text}`;
    }

    return `"${text.replace(/"/g, '""')}"`;
  };

  const rows = registrations.map((r) => [
    r.attendeeName,
    r.attendeeEmail,
    r.bookedAt,
    r.checkedIn ? "Checked in" : "Not checked in",
  ]);

  const csv = [
    headers,
    ...rows,
  ]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${eventTitle.replace(/[^a-z0-9_-]/gi, "_")}_attendees.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
export default function MyEvents({ user, onChanged }) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState({ kind: "", text: "" });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [registrationStatus, setRegistrationStatus] = useState("idle");
  const [registrationError, setRegistrationError] = useState("");

  async function handleCancel(e) {
    const id = e.eventId ?? e._id;
    setNotice({ kind: "", text: "" });
    try {
      const res = await fetch(`/api/events/${id}/cancel`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Could not cancel the event (HTTP ${res.status}).`);
      setEvents((list) => list.map((x) => ((x.eventId ?? x._id) === id ? { ...x, ...body.event, registeredCount: 0 } : x)));
      setNotice({ kind: "ok", text: body.message || "Event cancelled." });
      if (selectedEvent === id) {
        setSelectedEvent(null);
        setRegistrations([]);
      }
      if (onChanged) onChanged();
    } catch (err) {
      setNotice({ kind: "error", text: err.message });
    } finally {
      setCancelling(null);
      setReason("");
    }
  }

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/events/mine", { headers: authHeaders() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Could not load your events (HTTP ${res.status}).`);
      setEvents(Array.isArray(body) ? body : body.events ?? []);
      setStatus("ready");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function loadRegistrations(event) {
    const id = event.eventId ?? event._id;
    setSelectedEvent(id);
    setRegistrations([]);
    setRegistrationError("");
    setRegistrationStatus("loading");
    try {
      const res = await fetch(`/api/events/${id}/registrations`, { headers: authHeaders() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Could not load registrations (HTTP ${res.status}).`);
      setRegistrations(body.registrations ?? []);
      setRegistrationStatus("ready");
    } catch (err) {
      setRegistrationError(err.message);
      setRegistrationStatus("error");
    }
  }

  function handleSaved(updated) {
    const id = updated.eventId ?? updated._id;
    setEvents((list) => list.map((e) => ((e.eventId ?? e._id) === id ? { ...e, ...updated } : e)));
    setEditing(updated);
    if (onChanged) onChanged();
  }

  if (editing) {
    return (
      <CreateEvent
        key={editing.eventId ?? editing._id}
        event={editing}
        onSaved={handleSaved}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <section aria-labelledby="my-events-heading">
      <h2 id="my-events-heading">{user?.role === "Admin" ? "All events" : "My events"}</h2>
      {status === "loading" && <p role="status">Loading your events...</p>}
      {status === "error" && (
        <p className="message error" role="alert">
          {error}{" "}
          <button type="button" className="btn btn-secondary" onClick={load}>Try again</button>
        </p>
      )}
      {notice.text && (
        <p className={notice.kind === "error" ? "message error" : "message"} role={notice.kind === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}
      {status === "ready" && events.length === 0 && <p>You have not created any events yet.</p>}
      {status === "ready" && events.length > 0 && (
        <ul className="my-events">
          {events.map((e) => {
            const id = e.eventId ?? e._id;
            return (
              <li key={id} className="card">
                <h3>{e.title}</h3>
                <p>
                  {e.category} · {formatDate(e.date)} · {e.venue || "No venue set"} ·{" "}
                  {e.price ? `₹${e.price}` : "Free"} · {e.registeredCount ?? 0}/{e.capacity ?? "?"} booked ·{" "}
                  <strong>{e.status}</strong>
                </p>
                {e.status === "cancelled" && e.cancelReason && <p>Reason: {e.cancelReason}</p>}
                {e.status !== "cancelled" && (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditing(e)}>
                      Edit <span className="sr-only">{e.title}</span>
                    </button>{" "}
                    <button type="button" className="btn btn-secondary" onClick={() => loadRegistrations(e)}>
                      View registrations <span className="sr-only">for {e.title}</span>
                    </button>{" "}
                    {cancelling !== id && (
                      <button type="button" className="btn btn-secondary" onClick={() => { setCancelling(id); setReason(""); }}>
                        Cancel event <span className="sr-only">{e.title}</span>
                      </button>
                    )}
                  </>
                )}
                {selectedEvent === id && (
                  <div className="registrations" aria-label={`Registrations for ${e.title}`}>
                    <h4>Registrations</h4>
                    {registrationStatus === "ready" && (
  <button
    type="button"
   onClick={() => exportRegistrationsToCsv(registrations, e.title)}
  >
    Download CSV
  </button>
)}
                    <button type="button" className="btn btn-secondary" onClick={() => { setSelectedEvent(null); setRegistrations([]); }}>
                      Close registrations
                    </button>
                    {registrationStatus === "loading" && <p role="status">Loading registrations...</p>}
                    {registrationStatus === "error" && <p className="message error" role="alert">{registrationError}</p>}
                    {registrationStatus === "ready" && registrations.length === 0 && <p>No confirmed registrations yet.</p>}
                    {registrationStatus === "ready" && registrations.length > 0 && (
                      <>
                        <p>Total registrations: {registrations.length}</p>
                        <ul>
                          {registrations.map((r) => (
                            <li key={r.registrationId}>
                              <strong>{r.attendeeName}</strong>
                              <p>{r.attendeeEmail}</p>
                              <p>Booked: {formatDate(r.bookedAt)}</p>
                              <p>Check-in: {r.checkedIn ? "Checked in" : "Not checked in"}</p>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
                {cancelling === id && (
                  <div className="confirm" role="group" aria-label={`Confirm cancelling ${e.title}`}>
                    <p>
                      Cancel this event? {e.registeredCount ?? 0} booked attendee{e.registeredCount === 1 ? "" : "s"} will
                      get a cancellation alert and their tickets will stop working.
                    </p>
                    <div className="field">
                      <label htmlFor={`cancel-reason-${id}`}>Reason (optional, sent to attendees)</label>
                      <input
                        id={`cancel-reason-${id}`}
                        value={reason}
                        maxLength={500}
                        onChange={(ev) => setReason(ev.target.value)}
                      />
                    </div>
                    <button type="button" className="btn" onClick={() => handleCancel(e)}>Yes, cancel event</button>{" "}
                    <button type="button" className="btn btn-secondary" onClick={() => setCancelling(null)}>Keep it</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}



