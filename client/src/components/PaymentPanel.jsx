import React, { useState } from "react";
import { confirmPayment, failPayment, openRazorpay, sandboxCheckout } from "../api/payments.js";

// EMS-F-013: pay for a held seat. The card is entered only on the gateway's page (EMS-SR-003);
// with the built-in sandbox gateway no card is asked for at all.
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });

export default function PaymentPanel({ ticket, user, onPaid, onFailed }) {
  const [state, setState] = useState({ status: "idle", message: "" });
  const payment = ticket.payment;
  const title = ticket.event?.title ?? "your event";
  const amount = `₹${Number(payment.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const isSandbox = payment.provider === "sandbox";

  async function pay(outcome) {
    setState({ status: "paying", message: "" });
    try {
      let result;
      if (isSandbox) {
        result = await sandboxCheckout(payment.paymentId, outcome);
      } else {
        result = await openRazorpay(payment.checkout ?? {}, { title, name: user?.name, email: user?.email });
      }
      const done = await confirmPayment(payment.paymentId, result);
      setState({ status: "paid", message: done.message });
      onPaid?.(done.receipt);
    } catch (err) {
      if (err.dismissed) {
        setState({ status: "idle", message: "Payment window closed. Your seat is still held until the time shown." });
        return;
      }
      // The gateway declined (or the checkout failed): release the seat so the booking is not confirmed.
      let message = err.message;
      try {
        const failed = await failPayment(payment.paymentId, err.message);
        message = `${err.message}. ${failed.message}`;
      } catch {
        /* already finished on the server */
      }
      setState({ status: "error", message });
      onFailed?.(message);
    }
  }

  return (
    <div className="payment-panel" role="group" aria-label={`Pay for ${title}`}>
      <p>
        <strong>Payment needed: {amount}</strong>
        {ticket.holdExpiresAt && <> &middot; seat held until {timeFmt.format(new Date(ticket.holdExpiresAt))}</>}
      </p>
      {isSandbox ? (
        <>
          <p className="desc">
            Test payment gateway: no real money moves and no card is needed. In production this opens the payment
            provider&apos;s secure page.
          </p>
          <button type="button" className="btn" disabled={state.status === "paying"} onClick={() => pay("success")}>
            {state.status === "paying" ? "Paying..." : `Pay ${amount}`}
          </button>{" "}
          <button type="button" className="btn btn-secondary" disabled={state.status === "paying"} onClick={() => pay("failure")}>
            Simulate a failed payment
          </button>
        </>
      ) : (
        <button type="button" className="btn" disabled={state.status === "paying"} onClick={() => pay("success")}>
          {state.status === "paying" ? "Opening payment page..." : `Pay ${amount} securely`}
        </button>
      )}
      {state.message && (
        <p className={state.status === "error" ? "message error" : "message"} role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      )}
    </div>
  );
}
