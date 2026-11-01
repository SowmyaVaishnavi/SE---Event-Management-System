# Payments, receipts and refunds (EMS-F-013, F-014, F-015, SR-003)

Owner: Developer. Test cases: **TC-Pay-01**, **TC-Pay-02**, **TC-Pay-03**, **TC-Sec-03**.
Design: SAD 3.2 "Payment & Notification Service", SAD 3.6 risk "payment gateway downtime", SAD 1.3 constraint "PCI-DSS compliant payment gateway with no raw card data stored by EMS".

## 1. How a paid booking works

```
Attendee            React UI                  EMS API (Express)                 Payment gateway
   | Book a spot        |                             |                                 |
   |------------------->| POST /events/:id/register   |                                 |
   |                    |---------------------------->| booking = pending_payment       |
   |                    |                             | (seat held 15 min)              |
   |                    |                             |-- create order (amount, INR) -->|
   |                    |<-- 201 {payment, checkout} --|<--------- orderId ---------------|
   | Pay (My tickets)   |                             |                                 |
   |------------------->|----------- card typed only on the gateway's page ----------->|
   |                    |<------------------ { paymentId, signature } ----------------|
   |                    | POST /payments/:id/confirm  |                                 |
   |                    |---------------------------->| check HMAC signature            |
   |                    |                             | payment = paid, receipt no.     |
   |                    |                             | booking = confirmed             |
   |                    |<-- 200 {receipt} -----------|                                 |
   | sees receipt       |                             | + "payment received" alert      |
```

- **F-013: a paid booking is only confirmed once the payment succeeds.** Until then the booking is `pending_payment`: it holds a seat for 15 minutes, its ticket is refused at check-in ("This ticket is not paid yet"), and it shows "Payment pending" under My tickets with a **Pay** button.
- The server confirms only when the gateway's **signature** checks out (HMAC-SHA256 of `order_id|payment_id`). A browser cannot fake a payment.
- **Payment fails or is declined:** the payment becomes `failed`, the booking is cancelled (`payment_failed`) and the seat is released at once. The attendee can book again.
- **Hold runs out:** the next booking attempt for that event releases it (`payment_expired`). If the gateway still reports a successful payment afterwards, the payment is recorded as `paid` with `refundDue: true` and the booking is **not** confirmed. The Admin then refunds it.
- **Gateway down when booking:** nothing is held and nothing is charged (`502`, "try again"). This covers the SAD 3.6 risk.
- **Free events** (price 0) are unchanged: confirmed straight away, no payment record.

## 2. Receipt (F-014)

Right after a successful payment the UI shows the receipt. It is also available later from **View receipt** on the ticket (`GET /api/payments/:id/receipt`). It shows:

receipt number (`RCPT-YYYYMMDD-XXXXXX`), amount paid, date and time paid, event title, event date, venue, attendee name and email, ticket code, and the gateway's payment reference. **Print / save as PDF** prints only the receipt.

Every value comes from the stored payment (the amount is stored in whole paise), so the receipt always matches what was charged. Only the attendee who paid, or an Admin, can open it.

## 3. Refunds (F-015)

Only an **Admin** can refund (`403` for anyone else). In the UI: **Payments** (Admin nav) shows paid payments, marked when the event or booking was cancelled or a refund is due. Use **Refund**, add an optional reason, then confirm.

A payment can be refunded when it is `paid` and any of these is true:

- the attendee cancelled the booking (F-012),
- the organizer cancelled the event (F-006),
- the payment arrived after the seat hold ended (`refundDue`),
- the event has not started yet. A refund then also cancels the booking and frees the seat.

A payment for an event that already went ahead, with an active booking, is **not** eligible.

On refund: the gateway refunds the money; the payment becomes `refunded` with the refund id, time, Admin and reason; the booking is cancelled if it was still active; and the attendee gets a **"Refund completed"** alert (Alerts page, plus email if configured). If the gateway refuses the refund, nothing changes (`502`) and the Admin can retry.

## 4. No raw card data (SR-003, PCI-DSS)

EMS never receives, stores or logs card numbers.

| Control | Where |
|---------|-------|
| The card is typed only on the gateway's own page or popup (Razorpay Checkout). The sandbox gateway asks for no card at all. | `client/src/components/PaymentPanel.jsx` |
| Every API request body is checked. Card-number fields (`cardNumber`, `cvv`, `pan`, `expiry`, ...) or any Luhn-valid 13-19 digit number are refused with `400`, and the body is not logged. | `backend/lib/cardData.js` (`rejectCardData` in `server.js`) |
| The Payment record stores only gateway ids, amount and status. Its schema is `strict: "throw"`, so saving any other field fails. | `backend/models/Payment.js` |
| A database audit scans every document in every collection for card fields or card numbers. It prints only where they were found, never the value, and exits with code 1 if anything is found. | `npm run audit:card-data` |

With this design EMS falls under the lightest PCI-DSS self-assessment (SAQ A: card data handled entirely by the provider).

## 5. Gateways and setup

| Provider | When | Notes |
|----------|------|-------|
| `sandbox` (default) | No Razorpay keys set | Built-in test gateway for the demo and the tests. No money moves. **Pay** succeeds; **Simulate a failed payment** declines. Payments are signed exactly like a real gateway's. |
| `razorpay` | `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` set in `backend/.env` | Use **test keys** (`rzp_test_...`) from the Razorpay dashboard for the course demo, and Razorpay's test cards on their page. Orders and refunds go through Razorpay's REST API; the UI opens Razorpay Checkout. |

The key secret stays on the server; only the key id (public) is sent to the browser.

## 6. How to test

Automated (no MongoDB needed): `cd backend && npm test` (`test/payments.test.js`, `test/cardData.test.js`) and `cd client && npm test` (`src/test/Payments.test.jsx`).

Manual, with the sandbox gateway:

1. **TC-Pay-01:** As an Organizer, create an event with price 499.50 and capacity 1. As an Attendee, choose **Book a spot**. My tickets shows "Payment pending" and the ticket is refused at check-in. Choose **Pay ₹499.50**: the ticket shows "Confirmed" with a QR code. Repeat with **Simulate a failed payment**: the booking is cancelled and another attendee can now book the seat.
2. **TC-Pay-02:** After paying, check the receipt: amount ₹499.50, the event title, the event date and today's payment date. **View receipt** later shows the same.
3. **TC-Pay-03:** As an Attendee, try `POST /api/payments/<id>/refund` (403). As an Admin, open **Payments**, refund the payment, and check that the attendee sees "Refund completed" under Alerts.
4. **TC-Sec-03:** Send `{"cardNumber":"4111 1111 1111 1111"}` to any endpoint (400). Then run `cd backend && npm run audit:card-data`. It should report `0 with card data`.
