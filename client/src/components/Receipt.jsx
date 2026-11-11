import React from "react";

// EMS-F-014: payment receipt. Everything shown comes from the stored payment, so it matches what was charged.
const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const fmt = (iso) => (iso ? dateFmt.format(new Date(iso)) : "-");

export default function Receipt({ receipt, onClose }) {
  if (!receipt) return null;
  return (
    <section className="receipt card" aria-labelledby={`receipt-${receipt.receiptNumber}`}>
      <h3 id={`receipt-${receipt.receiptNumber}`}>Payment receipt</h3>
      {receipt.status === "refunded" && (
        <p className="message" role="status">Refunded on {fmt(receipt.refundedAt)}</p>
      )}
      <dl className="meta">
        <div><dt>Receipt no.</dt><dd className="code">{receipt.receiptNumber}</dd></div>
        <div><dt>Amount paid</dt><dd><strong>{receipt.amountText}</strong></dd></div>
        <div><dt>Paid on</dt><dd>{fmt(receipt.paidAt)}</dd></div>
        <div><dt>Event</dt><dd>{receipt.event?.title ?? "-"}</dd></div>
        <div><dt>Event date</dt><dd>{fmt(receipt.event?.date)}</dd></div>
        {receipt.event?.venue && <div><dt>Venue</dt><dd>{receipt.event.venue}</dd></div>}
        {receipt.attendee && <div><dt>Attendee</dt><dd>{receipt.attendee.name} ({receipt.attendee.email})</dd></div>}
        {receipt.ticketCode && <div><dt>Ticket code</dt><dd className="code">{receipt.ticketCode}</dd></div>}
        <div><dt>Payment ref.</dt><dd className="code">{receipt.paymentReference}</dd></div>
      </dl>
      <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
        Print / save as PDF
      </button>{" "}
      {onClose && (
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close receipt
        </button>
      )}
    </section>
  );
}
