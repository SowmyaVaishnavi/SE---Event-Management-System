import React, { useCallback, useEffect, useState } from "react";
import { fetchAllPayments, refundPayment } from "../api/payments.js";

// EMS-F-015: Admin-only list of payments with a Refund action for eligible ones.
const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const inr = (n) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const FILTERS = [["paid", "Paid"], ["refunded", "Refunded"], ["failed", "Failed"], ["", "All"]];

export default function AdminPayments() {
  const [filter, setFilter] = useState("paid");
  const [state, setState] = useState({ status: "loading", items: [], error: "" });
  const [refunding, setRefunding] = useState(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState({ kind: "", text: "" });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: "" }));
    try {
      setState({ status: "ready", items: await fetchAllPayments(filter), error: "" });
    } catch (err) {
      setState({ status: "error", items: [], error: err.message });
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRefund(p) {
    setNotice({ kind: "", text: "" });
    try {
      const res = await refundPayment(p.paymentId, reason.trim());
      setNotice({ kind: "ok", text: `${res.message} (${p.attendee?.name ?? "attendee"}, ${inr(p.amount)})` });
      await load();
    } catch (err) {
      setNotice({ kind: "error", text: err.message });
    } finally {
      setRefunding(null);
      setReason("");
    }
  }

  return (
    <section aria-labelledby="payments-heading">
      <h2 id="payments-heading">Payments and refunds</h2>
      <div className="nav" role="group" aria-label="Show payments">
        {FILTERS.map(([value, label]) => (
          <button key={label} type="button" className="btn btn-secondary" aria-pressed={filter === value} onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
      </div>
      {notice.text && (
        <p className={notice.kind === "error" ? "message error" : "message"} role={notice.kind === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}
      {state.status === "loading" && <p role="status">Loading payments&hellip;</p>}
      {state.status === "error" && <p className="message error" role="alert">{state.error}</p>}
      {state.status === "ready" && state.items.length === 0 && <p role="status">No payments here.</p>}
      {state.status === "ready" && state.items.length > 0 && (
        <ul className="my-events">
          {state.items.map((p) => (
            <li key={p.paymentId} className="card">
              <h3>
                {inr(p.amount)} &middot; {p.event?.title ?? "Event"}
              </h3>
              <p>
                {p.attendee?.name} ({p.attendee?.email}) &middot; {p.status}
                {p.paidAt && <> on {dateFmt.format(new Date(p.paidAt))}</>}
                {p.receiptNumber && <> &middot; {p.receiptNumber}</>}
                {p.event?.status === "cancelled" && <> &middot; <strong>event cancelled</strong></>}
                {p.bookingStatus === "cancelled" && p.status === "paid" && <> &middot; <strong>booking cancelled</strong></>}
                {p.refundDue && <> &middot; <strong>refund due</strong></>}
              </p>
              {p.status === "paid" && p.refundable && refunding !== p.paymentId && (
                <button type="button" className="btn btn-secondary" onClick={() => { setRefunding(p.paymentId); setReason(""); }}>
                  Refund<span className="sr-only"> {inr(p.amount)} to {p.attendee?.name}</span>
                </button>
              )}
              {p.status === "paid" && !p.refundable && <p className="desc">Not eligible for a refund (the event went ahead).</p>}
              {refunding === p.paymentId && (
                <div className="confirm" role="group" aria-label={`Confirm refund to ${p.attendee?.name}`}>
                  <p>
                    Refund {inr(p.amount)} to {p.attendee?.name}? Their booking will be cancelled if still active, and they
                    will get an alert.
                  </p>
                  <div className="field">
                    <label htmlFor={`refund-reason-${p.paymentId}`}>Reason (optional, sent to the attendee)</label>
                    <input id={`refund-reason-${p.paymentId}`} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
                  </div>
                  <button type="button" className="btn" onClick={() => handleRefund(p)}>Yes, refund</button>{" "}
                  <button type="button" className="btn btn-secondary" onClick={() => setRefunding(null)}>Keep payment</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
