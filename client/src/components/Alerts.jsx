import React, { useCallback, useEffect, useState } from "react";

// In-app alerts (GET /api/notifications/me): event cancelled (EMS-F-006), refund done (EMS-F-015), ...
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

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function Alerts() {
  const [state, setState] = useState({ status: "loading", items: [], error: "" });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: "" }));
    try {
      const res = await fetch("/api/notifications/me", { headers: authHeaders() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Could not load your alerts (HTTP ${res.status}).`);
      setState({ status: "ready", items: body.notifications ?? [], error: "" });
    } catch (err) {
      setState({ status: "error", items: [], error: err.message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id) {
    setState((s) => ({ ...s, items: s.items.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)) }));
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST", headers: authHeaders() });
    } catch {
      /* the next reload shows the real state */
    }
  }

  if (state.status === "loading") return <p role="status">Loading your alerts&hellip;</p>;
  if (state.status === "error") {
    return (
      <div className="state state-error" role="alert">
        <p>{state.error}</p>
        <button type="button" className="btn" onClick={load}>Try again</button>
      </div>
    );
  }

  return (
    <section aria-labelledby="alerts-heading">
      <h2 id="alerts-heading">Alerts</h2>
      {state.items.length === 0 ? (
        <p className="state" role="status">No alerts yet.</p>
      ) : (
        <ul className="my-events">
          {state.items.map((n) => (
            <li key={n.id} className={n.readAt ? "card alert-read" : "card"}>
              <h3>
                {!n.readAt && <span className="badge">New</span>} {n.title}
              </h3>
              <p>{n.message}</p>
              <p className="desc">
                <time dateTime={n.createdAt}>{dateFmt.format(new Date(n.createdAt))}</time>
              </p>
              {!n.readAt && (
                <button type="button" className="btn btn-secondary" onClick={() => markRead(n.id)}>
                  Mark as read<span className="sr-only">: {n.title}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
