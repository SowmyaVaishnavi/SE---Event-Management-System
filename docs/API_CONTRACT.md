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
