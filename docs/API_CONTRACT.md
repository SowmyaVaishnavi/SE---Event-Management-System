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
