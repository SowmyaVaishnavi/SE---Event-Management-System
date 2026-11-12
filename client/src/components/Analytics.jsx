import React, { useCallback, useEffect, useState } from "react";
import { fetchAnalytics } from "../api/analytics.js";

const inr = (n) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export default function Analytics() {
  const [state, setState] = useState({ status: "loading", data: null, error: "" });

  const load = useCallback(async () => {
    setState({ status: "loading", data: null, error: "" });
    try {
      setState({ status: "ready", data: await fetchAnalytics(), error: "" });
    } catch (err) {
      setState({ status: "error", data: null, error: err.message });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { status, data, error } = state;

  return (
    <section aria-labelledby="analytics-heading">
      <h2 id="analytics-heading">Event analytics</h2>
      {status === "loading" && <p role="status">Loading analytics&hellip;</p>}
      {status === "error" && (
        <div>
          <p className="message error" role="alert">{error}</p>
          <button type="button" className="btn btn-secondary" onClick={load}>Try again</button>
        </div>
      )}
      {status === "ready" && data.events.length === 0 && <p role="status">No events yet, so there is nothing to show.</p>}
      {status === "ready" && data.events.length > 0 && (
        <>
          <ul className="my-events" aria-label="Totals">
            <li className="card"><h3>Total bookings</h3><p><strong>{data.totalBookings}</strong></p></li>
            <li className="card"><h3>Total attendance</h3><p><strong>{data.totalAttendance}</strong> checked in</p></li>
            <li className="card"><h3>Total revenue</h3><p><strong>{inr(data.totalRevenue)}</strong></p></li>
          </ul>
          <h3>Per event</h3>
          <div style={{ overflowX: "auto" }}>
            <table>
              <caption className="sr-only">Bookings, attendance and revenue for each event</caption>
              <thead>
                <tr>
                  <th scope="col">Event</th><th scope="col">Status</th><th scope="col">Bookings</th>
                  <th scope="col">Attendance</th><th scope="col">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e) => (
                  <tr key={e.eventId}>
                    <th scope="row">{e.title}</th>
                    <td>{e.status}</td>
                    <td>{e.totalBookings}</td>
                    <td>{e.totalAttendance}</td>
                    <td>{inr(e.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}