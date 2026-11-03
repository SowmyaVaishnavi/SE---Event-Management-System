import React, { useCallback, useEffect, useState } from "react";
import { fetchAuditLogs, fetchAuditStatus } from "../api/auditLogs.js";

// EMS-SR-005 / EMS-NF-004: Admin-only view of the audit log (logins, lockouts, event, booking and payment actions),
// including rows moved to the archive. Rows are kept at least 2 years; this screen is read-only.
const CATEGORIES = [["", "All"], ["auth", "Sign-in"], ["event", "Events"], ["booking", "Bookings"], ["payment", "Payments"]];
const OUTCOMES = [["", "Any result"], ["success", "Success"], ["failure", "Failure"], ["denied", "Denied"]];
const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "medium" });
const label = (action) => action.replace(/_/g, " ");

export default function AuditLog() {
  const [filters, setFilters] = useState({ category: "", outcome: "", from: "", to: "", archived: true });
  const [state, setState] = useState({ status: "loading", logs: [], next: null, error: "" });
  const [info, setInfo] = useState(null);

  const load = useCallback(async (before) => {
    setState((s) => ({ ...s, status: "loading", error: "" }));
    try {
      const page = await fetchAuditLogs(filters, before);
      setState((s) => ({ status: "ready", logs: before ? [...s.logs, ...page.logs] : page.logs, next: page.nextBefore, error: "" }));
    } catch (err) {
      setState({ status: "error", logs: [], next: null, error: err.message });
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchAuditStatus().then(setInfo).catch(() => setInfo(null)); }, []);

  const set = (name) => (e) => setFilters((f) => ({ ...f, [name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <section aria-labelledby="audit-heading">
      <h2 id="audit-heading">Audit log</h2>
      {info && (
        <p className="desc">
          {info.recent + info.archived} entries ({info.archived} archived). Entries are kept for at least {info.retentionYears} years and
          move to the archive after {info.archiveAfterDays} days.
        </p>
      )}

      <div className="nav" role="group" aria-label="Show entries about">
        {CATEGORIES.map(([value, text]) => (
          <button key={text} type="button" className="btn btn-secondary" aria-pressed={filters.category === value} onClick={() => setFilters((f) => ({ ...f, category: value }))}>
            {text}
          </button>
        ))}
      </div>

      <div className="filters">
        <div className="field">
          <label htmlFor="audit-outcome">Result</label>
          <select id="audit-outcome" value={filters.outcome} onChange={set("outcome")}>
            {OUTCOMES.map(([value, text]) => <option key={text} value={value}>{text}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="audit-from">From</label>
          <input id="audit-from" type="date" value={filters.from} onChange={set("from")} />
        </div>
        <div className="field">
          <label htmlFor="audit-to">To</label>
          <input id="audit-to" type="date" value={filters.to} onChange={set("to")} />
        </div>
        <div className="field">
          <label htmlFor="audit-archived">
            <input id="audit-archived" type="checkbox" checked={filters.archived} onChange={set("archived")} /> Include archived entries
          </label>
        </div>
      </div>

      {state.status === "loading" && state.logs.length === 0 && <p role="status">Loading the audit log&hellip;</p>}
      {state.status === "error" && <p className="message error" role="alert">{state.error}</p>}
      {state.status === "ready" && state.logs.length === 0 && <p role="status">No entries match.</p>}

      {state.logs.length > 0 && (
        <ul className="my-events" aria-label="Audit log entries">
          {state.logs.map((l) => (
            <li key={l.id} className="card">
              <h3>
                {label(l.action)} <span className="desc">&middot; {l.outcome}</span>
              </h3>
              <p>
                {when.format(new Date(l.at))} &middot; {l.category}
                {l.actorLabel && <> &middot; {l.actorLabel}</>}
                {l.role && <> &middot; {l.role}</>}
                {l.ip && <> &middot; {l.ip}</>}
                {l.archived && <> &middot; <strong>archived</strong></>}
              </p>
              {l.target && <p className="desc">{l.target}</p>}
              {l.detail && <p className="desc">{JSON.stringify(l.detail)}</p>}
            </li>
          ))}
        </ul>
      )}

      {state.next && (
        <button type="button" className="btn btn-secondary" disabled={state.status === "loading"} onClick={() => load(state.next)}>
          Load older entries
        </button>
      )}
    </section>
  );
}
