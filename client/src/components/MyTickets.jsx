import React, { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { cancelBooking, fetchMyTickets } from "../api/bookings.js";

const dateFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** QR image for one ticket code (EMS-F-011). The code is also printed as text. */
function TicketQr({ code, title }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(code, { margin: 1, width: 220 })
      .then((url) => live && setSrc(url))
      .catch(() => live && setSrc(""));
    return () => {
      live = false;
    };
  }, [code]);
  if (!src) return null;
  return <img className="qr" src={src} width="220" height="220" alt={`QR code for your ${title} ticket. Ticket code ${code}`} />;
}

/** My tickets: show ticket + QR (EMS-F-011, F-020) and cancel a booking (EMS-F-012). */
export default function MyTickets() {
  const [state, setState] = useState({ status: "loading", tickets: [], error: "" });
  const [confirming, setConfirming] = useState(null);
  const [notice, setNotice] = useState({ kind: "", text: "" });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: "" }));
    try {
      setState({ status: "ready", tickets: await fetchMyTickets(), error: "" });
    } catch (err) {
      setState({ status: "error", tickets: [], error: err.message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCancel(bookingId) {
    setNotice({ kind: "", text: "" });
    try {
      const data = await cancelBooking(bookingId);
      setNotice({ kind: "ok", text: data.message || "Booking cancelled." });
      setConfirming(null);
      await load();
    } catch (err) {
      setNotice({ kind: "error", text: err.message });
      setConfirming(null);
    }
  }

  if (state.status === "loading") return <p role="status">Loading your tickets&hellip;</p>;
  if (state.status === "error") {
    return (
      <div className="state state-error" role="alert">
        <p>{state.error}</p>
        <button type="button" className="btn" onClick={load}>Try again</button>
      </div>
    );
  }

  return (
    <section aria-labelledby="tickets-heading">
      <h2 id="tickets-heading">My tickets</h2>
      <p className={`message ${notice.kind === "error" ? "error" : ""}`} role={notice.kind === "error" ? "alert" : "status"}>
        {notice.text}
      </p>
      {state.tickets.length === 0 ? (
        <p className="state" role="status">You have not booked any events yet. Browse events and choose Book a spot.</p>
      ) : (
        <ul className="grid">
          {state.tickets.map((t) => {
            const title = t.event?.title ?? "Event";
            const active = t.status === "confirmed";
            return (
              <li className="card ticket" key={t.bookingId}>
                <article aria-labelledby={`ticket-${t.bookingId}`}>
                  <div className="card-top">
                    <span className="chip">{t.event?.category ?? "Event"}</span>
                    <span className={`badge ${t.checkedInAt ? "used" : t.status}`}>
                      {t.status === "cancelled" ? "Cancelled" : t.checkedInAt ? "Checked in" : "Confirmed"}
                    </span>
                  </div>
                  <h3 id={`ticket-${t.bookingId}`}>{title}</h3>
                  <dl className="meta">
                    {t.event?.date && (
                      <div><dt>Date</dt><dd>{dateFmt.format(new Date(t.event.date))}</dd></div>
                    )}
                    {t.event?.venue && (
                      <div><dt>Venue</dt><dd>{t.event.venue}</dd></div>
                    )}
                    <div><dt>Ticket code</dt><dd className="code">{t.ticketCode}</dd></div>
                  </dl>

                  {active && <TicketQr code={t.ticketCode} title={title} />}

                  {active && !t.checkedInAt && (
                    confirming === t.bookingId ? (
                      <div className="confirm" role="group" aria-label={`Confirm cancelling ${title}`}>
                        <p>Cancel this booking? Your seat will be released.</p>
                        <button type="button" className="btn" onClick={() => handleCancel(t.bookingId)}>Yes, cancel booking</button>{" "}
                        <button type="button" className="btn btn-secondary" onClick={() => setConfirming(null)}>Keep it</button>
                      </div>
                    ) : (
                      <button type="button" className="btn btn-secondary" onClick={() => setConfirming(t.bookingId)}>
                        Cancel booking<span className="sr-only"> for {title}</span>
                      </button>
                    )
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
