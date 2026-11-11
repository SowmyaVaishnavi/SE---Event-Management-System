# EMS API contract: events (Sprint 1)

Agreed between: Product Owner (frontend, EMS-F-008 / EMS-F-009) and Developer (backend, EMS-F-004..007).
Base design: SAD v1.0 section 4.3. The SAD only defines `POST /api/events`; the `GET` endpoints below are **additions** (see DEVIATIONS.md, D-05).

## POST /api/events (from SAD, unchanged)

Auth: Organizer or Admin JWT. Request:

```json
{ "title": "string", "description": "string", "category": "string",
  "capacity": 100, "date": "2026-11-05T10:00:00.000Z", "venue": "string", "price": 0 }
```

Response `201`: `{ "eventId": "...", "status": "published" }`
Errors: `400` validation, `401/403` auth.

## GET /api/events (new): list events for browse and filter

Auth: none required (public browse).

Query parameters, all optional and combined with AND:

| Param      | Meaning                                                      | Example      |
|------------|--------------------------------------------------------------|--------------|
| `category` | Exact match, case-insensitive                                | `Technical`  |
| `location` | Case-insensitive "contains" match on `venue`                 | `bangalore`  |
| `from`     | Events starting on/after this day (`yyyy-mm-dd`, inclusive)  | `2026-11-01` |
| `to`       | Events starting on/before this day (`yyyy-mm-dd`, inclusive) | `2026-11-30` |

Server rules (TC-Search-01): return only events with `status = "published"` and `date >= now`. Sort by `date` ascending.

Response `200`:

```json
{
  "events": [
    {
      "eventId": "66f1...",
      "title": "AI & Data Science Symposium",
      "description": "Talks and posters ...",
      "category": "Seminar",
      "capacity": 200,
      "registeredCount": 120,
      "date": "2026-11-05T10:00:00.000Z",
      "venue": "Main Auditorium, Bangalore",
      "price": 0,
      "status": "published"
    }
  ]
}
```

- `registeredCount` = number of confirmed bookings (used to show "seats left"). If it is missing, the UI shows no availability line.
- `price` is a number in INR, `0` means free.
- An empty result is `200` with `"events": []`, not `404`.
- Errors: `400` for an invalid `from`/`to` date, `500` with `{ "message": "..." }`.
- The frontend also accepts a bare array instead of `{ "events": [...] }`, and `_id` instead of `eventId`.

## GET /api/events/:id (new): single event (needed by booking, EMS-F-010)

Response `200`: one event object as above. `404` `{ "message": "Event not found" }`.

## Notes for the Developer

- The UI applies the same live/upcoming and filter rules again on the client. A backend that returns too much will not break the page, but the server should still filter (response time, NF-001).
- Allowed `category` values live in `src/config.js` (`CATEGORIES`). Please use the same list in the Mongoose schema enum.
- In dev the UI proxies `/api` to `http://localhost:5000`. Change it with `VITE_API_TARGET`.

## Event management (Developer: EMS-F-004, F-005, F-007)

Errors are `{ "message": "...", "errors": ["..."] }` (`errors` lists each problem when there is more than one).

### POST /api/events: extra rules

- Organizer or Admin token (`401` without a token, `403` for an Attendee).
- Optional `"status": "draft"` saves an unfinished event; a draft needs only `title`, `description`, `category`.
- Without `status` (or with `"published"`) the event also needs `capacity` (whole number 1-100000), `date` (ISO, in the future), `venue` and `price` (number >= 0). Missing or wrong values give `400`.
- `201` `{ "eventId": "...", "status": "published" | "draft", "event": { ...event as in GET } }`.

### GET /api/events/mine: my events (F-005)

Organizer: their own events, drafts included. Admin: all events. `200` `{ "events": [ ...event with registeredCount ] }`. `403` for an Attendee.

### PUT /api/events/:id: edit an event (F-005, F-007)

Organizer who created the event, or an Admin. Send only the fields to change, any of: `title`, `description`, `category`, `capacity`, `date`, `venue`, `price`, `status` (`draft` / `published`).

`200` `{ "message": "Event updated", "event": { ...the saved event } }`. The UI shows this right away.

- `400` invalid value, nothing to change, capacity lower than the seats already booked, a new date in the past, or publishing a draft that is missing details.
- `403` not the event's organizer (and not an Admin). `404` unknown id. `409` the event is cancelled, or going back to draft while it has bookings.

### POST /api/events/:id/cancel: cancel an event (F-006, SAD 4.3)

The event's organizer or an Admin. Optional body `{ "reason": "Venue unavailable" }` (at most 500 characters).

`200`:
```json
{ "status": "cancelled", "message": "Event cancelled. 12 attendees were alerted.", "bookingsCancelled": 12, "notified": 12, "event": { "...": "...", "status": "cancelled", "cancelledAt": "...", "cancelReason": "Venue unavailable" } }
```

- Every booking that was not already cancelled becomes `cancelled` with `cancelReason: "event_cancelled"`, so the ticket stops working at check-in.
- Each of those attendees gets a cancellation alert (see Notifications below). Paid bookings are refunded by an Admin (F-015).
- `403` not the event's organizer (and not an Admin). `404` unknown id. `409` already cancelled, or the event has already started. `400` bad `reason`.
- A cancelled event no longer appears in `GET /api/events` and cannot be booked or edited.

## Notifications (Developer, used by F-006 and F-015)

| Endpoint | Response |
|----------|----------|
| `GET /api/notifications/me` | `200 { unread, notifications: [ { id, type, title, message, eventId, createdAt, readAt } ] }`, newest first, at most 50. |
| `POST /api/notifications/:id/read` | `200 { message }`. `404` if the alert is not yours. |

`type` is one of `event_cancelled`, `payment_received`, `refund_completed`, `booking_confirmed`, `event_reminder`. If `NOTIFY_WEBHOOK_URL` is set, each alert is also emailed through that provider (3 tries); otherwise alerts are in-app only.

## Payments (Developer: EMS-F-013..015, SR-003)

Full flow and rules: `docs/PAYMENTS.md`. Amounts are INR rupees in responses (stored as whole paise). Requests must never contain card data (`400`).

### POST /api/events/:id/register for a paid event (price > 0)

`201`:
```json
{ "status": "pending_payment", "message": "Seat held for 15 minutes. Complete the payment to confirm your booking.",
  "bookingId": "...", "payment": { "paymentId": "...", "amount": 499.5, "currency": "INR", "provider": "sandbox", "status": "created", "checkout": { "provider": "sandbox", "orderId": "order_sbx_...", "amount": 49950, "currency": "INR" } },
  "checkout": { "...": "same as payment.checkout" }, "ticket": { "...": "status pending_payment" } }
```

- `409` already booked or a seat already held for this event. `502` gateway unavailable (nothing held or charged).
- Free events still return `201 { "status": "confirmed", ... }` as before.
- `GET /api/bookings/me` tickets now include `status: "pending_payment"`, `holdExpiresAt` and `payment` (`null` for free events). Check-in of an unpaid ticket gives `400 "This ticket is not paid yet"`.

| Endpoint | Who | Body | Response |
|----------|-----|------|----------|
| `POST /api/payments/:id/sandbox-checkout` | payer | `{ outcome: "success" \| "failure" }` | `200 { orderId, paymentId, signature }`, `402` declined. `404` when Razorpay is configured. |
| `POST /api/payments/:id/confirm` | payer | `{ paymentId, signature }` (from the gateway) | `200 { status: "paid", message, payment, receipt }`. `400` signature not valid (booking not confirmed). `409` paid after the hold ended (recorded, `refundDue`), or already refunded. Repeating a successful confirm returns `200` again. |
| `POST /api/payments/:id/fail` | payer | `{ reason? }` | `200`: payment `failed`, seat released. |
| `GET /api/payments/:id/receipt` | payer or Admin | | `200 { receipt: { receiptNumber, amount, amountText, paidAt, paymentReference, event { title, date, venue }, attendee { name, email }, ticketCode, status, refundedAt } }`. `409` not paid. `404` not yours. |
| `GET /api/payments/me` | any | | `200 { payments: [...] }` |
| `GET /api/payments?status=paid` | Admin | | `200 { payments: [ { ...payment, event, attendee, bookingStatus, refundable } ] }` |
| `POST /api/payments/:id/refund` | Admin | `{ reason? }` | `200 { status: "refunded", message, payment }`; the attendee gets a `refund_completed` alert. `403` not Admin. `409` not eligible / already refunded. `502` gateway refused (nothing changed). |

## Health and response time (Developer: EMS-NF-001)

| Endpoint | Who | Response |
|----------|-----|----------|
| `GET /api/health` | public | `200 { status: "ok", db: "connected", uptimeSeconds }`, or `503 { status: "degraded", db: "disconnected" }`. For uptime monitors. |
| `GET /api/health/metrics` | Admin | `200 { targetMs: 3000, sample, overall: { p50, p90, p95, max }, meetsTarget, routes: { "GET /api/events": { count, errors, slow, p50, p90, p95, max } } }` over the last 1,000 requests per route. |

Every response has a `Server-Timing: app;dur=<ms>` header. See `docs/PERFORMANCE.md`.

## Auth (Developer: EMS-F-001..003, SR-002)

| Endpoint | Body | Response |
|----------|------|----------|
| `POST /api/auth/register` | `{ name, email, password (8-72 chars), role: "Attendee" \| "Organizer", username? }` | `201 { message, user }`. `400` invalid, `409` email or username taken. |
| `POST /api/auth/login` | `{ username, password }` or `{ email, password }` | `200 { message, token, user }`. `401` "Invalid username/email or password". `423` account locked (SR-005): `{ message, retryAfterSeconds }` and a `Retry-After` header. |
| `GET /api/auth/me` | Bearer token | `200 { user }`, `401` if the token is missing or expired. |

`user` is `{ id, name, email, username, role }`; the password hash is never returned. The JWT (`HS256`, 1 day) carries `{ id, role }`. Role checks: `401` not logged in, `403` "You do not have access to this action. It is for ... accounts only". An Admin passes every Organizer check.

## Booking, tickets and check-in (Product Owner: EMS-F-010..012, F-019, F-020)

All routes need `Authorization: Bearer <token>`. Errors are `{ "message": "..." }`.

### POST /api/events/:id/register (F-010, F-011): Attendee only

No body. The attendee comes from the token, the event from the path.

`201`:
```json
{ "status": "confirmed", "ticketId": "66f2...", "qrCode": "EMS-7KQ2-M9XD-4TPA", "message": "Booking confirmed", "ticket": { "bookingId": "66f2...", "ticketCode": "EMS-7KQ2-M9XD-4TPA", "status": "confirmed", "event": { "eventId": "66f1...", "title": "...", "date": "...", "venue": "...", "price": 0 } } }
```

- `400` event full (no seats left). `404` event not found. `401` not logged in. `403` not an Attendee.
- `409` already booked this event, event not open for booking (status not `published`), or event already started.
- Capacity is read from the event's `capacity`; if the event has no capacity number there is no limit.

### GET /api/bookings/me (F-011, F-020): my tickets

`200` `{ "tickets": [ { "bookingId", "ticketCode", "status": "confirmed" | "cancelled", "checkedInAt": null | date, "bookedAt", "event": { ... } } ] }`, newest first.

### POST /api/bookings/:id/cancel (F-012): cancel my booking

`200` `{ "message": "Booking cancelled. Your seat has been released", "ticket": { ... } }`. The seat is freed and the ticket code stops working.

- `404` booking not found or not yours (same answer for both). `409` already cancelled, already checked in, or event already started.

### POST /api/checkin/scan (F-019): Organizer or Admin

Body `{ "qrCode": "EMS-7KQ2-M9XD-4TPA", "ticketId": "66f2..." }` (`ticketId` is optional; if sent it must match the code).

`200` `{ "status": "checked-in", "message": "Check-in successful", "attendee": { "name", "email" }, "ticket": { ... } }`

- `400` code missing, unknown, cancelled, or already used (the body still includes `attendee` and `ticket` for cancelled and used tickets). `401` / `403` not logged in or wrong role.

### What the Developer must provide for booking to work (EMS-F-004..008)

The Event schema needs `capacity` (Number), `date` (Date), `venue`, `price` (Number, default 0) and `status` (`published` / `cancelled`). Without them events do not show on the browse page, and capacity cannot be checked. `registeredCount` in `GET /api/events` should be the number of **confirmed** bookings: `Booking.countDocuments({ event, status: "confirmed" })`.

## Account lockout and audit log (EMS-SR-005, EMS-NF-004)

**Lockout.** After `LOGIN_MAX_ATTEMPTS` (default 5) wrong passwords in a row, the account is locked for `LOGIN_LOCK_MINUTES` (default 15). While locked, `POST /api/auth/login` answers `423 { message, retryAfterSeconds }` with a `Retry-After` header, even when the password is right. The lock ends by itself. A correct login before the limit resets the count. An email or username that does not exist always gets `401`.

**Audit log (Admin only, read-only).** There is no endpoint to change or delete a log row. Rows are kept at least 2 years (docs/LOG_RETENTION.md).

| Endpoint | Query | Response |
|----------|-------|----------|
| `GET /api/audit-logs` | `category` (`auth` / `event` / `booking` / `payment`), `action`, `outcome` (`success` / `failure` / `denied`), `actor` (user id), `from`, `to` (ISO date; a plain `to` date means that whole day), `archived=false` (leave out archived rows), `limit` (1-200, default 50), `before` (the `nextBefore` of the previous page) | `200 { logs: [ { id, at, category, action, outcome, actor, actorLabel, role, ip, target, detail, archived } ], nextBefore }`, newest first. `400 { message, errors }` for a bad filter. `401` / `403` not logged in / not an Admin. |
| `GET /api/audit-logs/status` | none | `200 { recent, archived, oldest, retentionYears, archiveAfterDays, droppedWrites }` |

Actions recorded: `register_success`, `register_rejected`, `login_success`, `login_failed`, `account_locked`, `login_blocked`, `access_denied` (category `auth`); `event_created`, `event_updated`, `event_cancelled` (`event`); `booking_held`, `booking_confirmed`, `booking_cancelled`, `checkin_success`, `checkin_refused` (`booking`); `payment_paid`, `payment_failed`, `payment_verification_failed`, `payment_paid_no_seat`, `payment_refunded` (`payment`). Passwords, tokens, ticket codes and card data are never written to the log.
