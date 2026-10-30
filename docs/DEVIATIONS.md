# DEVIATIONS.md - Event Management System (Team 13)

Owner: Product Owner. Covers differences between the submitted documents (SRS v1.0 05-09-2026, SAD v1.0 14-09-2026, Test Plan v1.0 14-09-2026) and what is built in Sprint 1. To be explained during the final demo.

Status key: **Open** = decision needed from the team, **Resolved** = decision recorded, **Build** = a change made while implementing.

## A. Inconsistencies inside the submitted documents

| ID   | Where | What the documents say | Decision for the build | Status |
|------|-------|------------------------|------------------------|--------|
| D-01 | SRS 5 (EMS-NF-001), SRS 8 RTM, SAD 3.1, STP 3 | Response time is **<= 3 s for 90%** of requests in SRS 5, SAD and STP. The RTM says **< 2 s for 95%**. | Build and test against **3 s / 90%** (3 of 4 places, and it is the acceptance criterion with test TC-Perf-01). RTM row to be corrected in the next SRS revision. | Resolved |
| D-02 | SRS 1.2 vs SRS 4.5, SAD 1.2 | SRS 1.2 says the system does **not** include payment processing "unless added in future versions". SRS 4.5 (EMS-F-013..015), the RTM and the SAD all require payments, receipts and refunds. | Payments are in scope (they are 3 High/Medium functional requirements with test cases). Payments are **not** in Sprint 1; they are planned for Sprint 2 through a payment gateway sandbox. SRS 1.2 wording to be corrected. | Resolved |
| D-03 | SRS 5 vs SRS 8 RTM (numbering) | **EMS-NF-002** is "99.5% uptime" in SRS 5, SAD and STP, but "500 concurrent users" in the RTM. **EMS-NF-003** is "HTTPS / no plaintext passwords" in SRS 5, but "encrypt at rest and in transit" in the RTM. | Section 5 wording is treated as the source of truth. The "500 concurrent users" target (SAD 3.1) is tracked as an extra performance goal under TC-Perf-01, not as NF-002. RTM IDs to be renumbered. | Resolved |
| D-04 | SRS 8 RTM, "Section Ref / Design Spec" | RTM points to SRS sections 5.1 (Perf), 5.2 (Perf), 5.3 (Sec) that do not exist (SRS 5 has only 5.1 Security). Design Spec IDs (`DS-...`) are not defined in the SAD. | Backlog issues reference the SRS requirement ID and the SAD section instead. No code impact. | Open (documentation fix) |
| D-05 | SAD 4.3 API design | The SAD defines only 5 endpoints. It has **no endpoint to list or read events**, which EMS-F-008 / F-009 need. `POST /api/events/{id}/register` also takes `eventId` in the body although it is already in the path, and says `401` for "unauthorized" but `400` for "event full" (a conflict is normally `409`). | Added `GET /api/events` and `GET /api/events/:id` (see API_CONTRACT.md). The register endpoint takes the attendee from the JWT; `eventId` comes only from the path. Status codes follow the SAD unless the team agrees to change them. | Build |
| D-06 | SRS 1.4 / 2.3 / 3 | Roles are called "Participant" (SRS 2.3), "Attendee" (SRS 3, 4) and "User" (1.2). | Code and UI use **Attendee**, **Organizer**, **Admin** only. | Resolved |

## B. Deviations introduced by the Sprint 1 build

| ID   | Area | Deviation | Reason | Status |
|------|------|-----------|--------|--------|
| D-07 | Event categories (F-004, F-009) | The SRS never lists the allowed categories. The UI offers: Technical, Cultural, Sports, Workshop, Seminar, Social, Other. | A fixed list is needed for the filter dropdown and for validation in the Event schema. Defined in one place (`src/config.js`). | Build |
| D-08 | Filter by "location" (F-009) | Events have a `venue` field (SAD 4.3). "Location" in the filter is a case-insensitive **contains** match on `venue`; there is no separate location/city field. | Matches the SAD data model; no extra field added. A city field can be added later if needed. | Build |
| D-09 | Filter by "date" (F-009) | Implemented as a **From / To date range** (either end optional) rather than a single date. | A range covers the single-day case (same From and To) and is more useful for browsing. | Build |
| D-10 | Event list response (F-008) | The list returns `registeredCount` in addition to the fields in the SAD. | Needed to show "seats left" / "Event full" (ties to EMS-F-010 capacity rule) without one extra API call per event. | Build |
| D-11 | Filtering done twice (TC-Search-01/02) | The API filters, and the React UI **re-applies** the live/upcoming and filter rules to whatever the API returns. | Guarantees the acceptance criteria hold during integration, when the backend filter may not be finished. Small cost, no UX impact. | Build |
| D-12 | Accessibility (NF-005) | Sprint 1 UI has labelled form fields, keyboard focus styles, a skip link, screen-reader announcements for result count, and a **High contrast** toggle. A full WCAG 2.1 AA audit (TC-UX-01) is **not** done in Sprint 1. | Time-boxed sprint; the audit is scheduled for Sprint 2. | Open |
| D-13 | Features not in Sprint 1 | Payments, ticket/QR, notifications, check-in, dashboard, refunds (EMS-F-010..023, SR-001 TLS verification, NF-001..004 measurements) are planned for Sprint 2. Sprint 1 covers auth, event management, browse and filter.Login and RBAC are not available in Sprint 1, so event creation is not role-protected yet. | Sprint plan: Sprint 1 about 32 points, Sprint 2 the rest. | Resolved |
| D-14 | Mock mode | `npm run dev:mock` serves built-in sample events so the UI can be demoed without the backend. It is for demos only and is not used in production builds. | The browse page was built in parallel with the backend. | Build |
| D-16 | Carry-over to Sprint 2 | Not delivered in Sprint 1 and carried over: #2 (login), #3 (RBAC), #5 (edit event), #29 (TLS), #30 (bcrypt). | Backend delivery delay, see D-15. Developer committed to #1, #4 and #7 only. | Open |
| D-17 | Booking, ticket, check-in (F-010..012, F-019, F-020) | Delivered by the Product Owner. These were listed as Sprint 2 in D-13 but are built now. Attendee cancel uses a new endpoint `POST /api/bookings/:id/cancel`, because the SAD's `/api/events/{id}/cancel` is the *organizer* cancelling a whole event. `GET /api/bookings/me` was also added so "My tickets" can list tickets. | SAD 4.3 has no endpoint for an attendee to cancel their own booking or to list their tickets. | Build |
| D-18 | Ticket / QR format (F-011) | The QR code contains only a random ticket code (`EMS-XXXX-XXXX-XXXX`, 12 characters, no 0/O/1/I). The SAD says "single-use ticket tokens with server-side validation". Validation is a lookup in the database; nothing is signed inside the QR. | A random code that is looked up on the server cannot be forged or guessed in practice, and it keeps the QR small and easy to scan. | Build |
| D-19 | Status codes (F-010, F-019) | Event full and invalid/used/cancelled ticket return `400`, as the SAD says. "Already booked this event" returns `409` (the SAD does not cover it). A second check-in of the same ticket returns `400` "Already checked in". | Follows SAD 4.3; `409` is used only where the SAD is silent. Attendee comes from the JWT, `eventId` from the path (see D-05). | Build |
| D-20 | Capacity rule (F-010) | Seats are counted as confirmed bookings at booking time (count, then create). Two attendees booking the very last seat at the same instant could both succeed. | Acceptable for the course demo load; a transaction or an atomic counter is the fix if it matters. A cancelled booking frees the seat at once (F-012). | Open |
| D-21 | Check-in scope (F-019) | Any Organizer or Admin can check in any ticket. The event has no organizer field yet, so an organizer is not limited to their own events. The camera scan works only in browsers that support `BarcodeDetector` (Chrome on Android, Safari); everywhere else the code is typed in. | No organizer-event link in the current Event model (EMS-F-004). Typed entry is always available. | Open |
| D-22 | Login and RBAC middleware (F-003) | `backend/middleware/auth.js` (`requireAuth`, `requireRole`) was added so booking and check-in can read the JWT. It is the minimum needed for these routes. | Replace with the QA Lead's version from EMS-4 when it lands; keep the same export names. | Open |

## C. To be filled in at the end of Sprint 1

Add one row for anything that was built differently from the SRS / SAD / Test Plan by the Developer, QA Lead or Test Engineer (for example, a different status code, a renamed field, or a test case that was changed).

| ID   | Area | Deviation | Reason | Reported by |
|------|------|-----------|--------|-------------|
| D-15 |      |           |        |             |
