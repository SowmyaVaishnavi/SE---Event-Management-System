import React, { useCallback, useEffect, useState } from "react";
import CreateEvent from "./CreateEvent.jsx";

// EMS-F-005: an organizer's own events (Admin: all events), with an Edit form for each.
// Uses GET /api/events/mine and PUT /api/events/:id.
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
  return Number.isNaN(d.getTime()) ? "No date set" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function MyEvents({ user, onChanged }) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

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

  function handleSaved(updated) {
    // Show the saved values right away, without waiting for a reload.
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
      {status === "ready" && events.length === 0 && <p>You have not created any events yet.</p>}
      {status === "ready" && events.length > 0 && (
        <ul className="my-events">
          {events.map((e) => (
            <li key={e.eventId ?? e._id} className="card">
              <h3>{e.title}</h3>
              <p>
                {e.category} · {formatDate(e.date)} · {e.venue || "No venue set"} ·{" "}
                {e.price ? `₹${e.price}` : "Free"} · {e.registeredCount ?? 0}/{e.capacity ?? "?"} booked ·{" "}
                <strong>{e.status}</strong>
              </p>
              {e.status !== "cancelled" && (
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(e)}>
                  Edit <span className="sr-only">{e.title}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
