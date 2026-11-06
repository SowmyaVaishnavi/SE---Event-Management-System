# EMS test cases — Sprint 1 baseline and Sprint 2 execution (issue #35)

Project: Event Management System, Team 13. Test Plan: `Test_plan_EMS.md` (STP v1.0). Requirements: SRS v1.0, RTM in SRS section 8.
Owner: Test Engineer. Last execution: **06-11-2026**, branch = `dhanyashree-sprint2-qa` (updated from latest `main`).

## 1. How to run

| What | Command | Result / latest evidence |
|------|---------|----------------------|
| Backend automated tests (Node test runner, in-memory database, no MongoDB needed) | `npm --prefix backend test` | **78 passed, 0 failed, 1 skipped** |
| Client automated tests (Vitest + Testing Library) | `npm --prefix client test` | **52 passed, 0 failed** |
| Client production build | `npm --prefix client run build` | Not re-run on 06-11-2026 |
| Same checks on every push and pull request | GitHub Actions workflow `CI` (`.github/workflows/ci.yml`) | runs on push |
| Database audits (need a running MongoDB) | `npm run audit:passwords`, `npm run audit:card-data` | Manual, see TC-Sec-02 and TC-Sec-03 |

Status legend: **Pass (auto)** = automated test exists and passed in the run above. **Manual** = needs a person or a deployed system; not run yet. **Not built** = the feature is still Todo on the board, so the case cannot run yet.

## 2. Summary

| Module | Test cases | Pass (auto) | Manual (not run) | Not built |
|--------|-----------:|------------:|-----------------:|----------:|
| Auth (F-001..F-003) | 3 | 3 | 0 | 0 |
| Events (F-004..F-007) | 4 | 4 | 0 | 0 |
| Search (F-008, F-009) | 2 | 2 | 0 | 0 |
| Booking (F-010..F-012) | 3 | 3 | 0 | 0 |
| Payments (F-013..F-015) | 3 | 3 | 0 | 0 |
| Notifications (F-016..F-018) | 3 | 1 | 0 | 2 |
| Check-in (F-019, F-020) | 2 | 2 | 0 | 0 |
| Dashboard (F-021..F-023) | 3 | 0 | 0 | 3 |
| Performance (NF-001, NF-002) | 2 | 0 | 2 (script evidence exists) | 0 |
| Security and operations (SR-001..SR-005, NF-004) | 6 | 5 | 1 | 0 |
| Usability (NF-005) | 1 | 0 | 1 | 0 |
| **Total** | **32** | **23** | **4** | **5** |

TC-Sec-01 (TLS) is counted under Manual: its automated test was skipped because OpenSSL was unavailable, and a traffic scan of a deployed system is still to do. TC-Sec-02 and TC-Sec-03 are counted as Pass (auto); the one-time database audit on the demo database is listed in section 5.

## 3. Test cases

Priority follows the SRS. "Automated in" lists the files that hold the checks.

### 3.1 Auth

| ID | Req | Title | Steps | Expected result | Automated in | Status |
|----|-----|-------|-------|-----------------|--------------|--------|
| TC-Auth-01 | F-001 | Sign up as Attendee or Organizer, then log in | 1. Open Register. 2. Enter name, email, optional username, password (8-72 chars), choose Attendee or Organizer. 3. Submit. 4. Log in with the same details. | `201` account created; login works right away; the response never contains the password; role `Admin` is refused at sign-up; duplicate email or username gives `409`; short password gives `400`. | `backend/test/auth.test.js` | Pass (auto) |
| TC-Auth-02 | F-002 | Log in with username or email | 1. Log in with the right username and password. 2. Log in with the right email. 3. Log in with a wrong password. 4. Log in with an unknown name. | Right details: `200` with a token and the user. Wrong password and unknown name both give the same `401` "Invalid username/email or password". | `backend/test/auth.test.js` | Pass (auto) |
| TC-Auth-03 | F-003 | Each role can only use its own features | 1. As Attendee, call an Organizer action. 2. As Organizer, call an Admin action. 3. As Admin, call an Organizer action. 4. Call with no token. | Attendee and Organizer get `403` naming the allowed roles; Admin passes Organizer checks; no token gives `401`. | `backend/test/auth.test.js` | Pass (auto) |

### 3.2 Events

| ID | Req | Title | Steps | Expected result | Automated in | Status |
|----|-----|-------|-------|-----------------|--------------|--------|
| TC-Event-01 | F-004 | Organizer creates an event | Log in as Organizer, send title, description, category, capacity, future date, venue, price. | `201` with `eventId`; the event shows in the browse list. | `backend/test/events.test.js` | Pass (auto) |
| TC-Event-02 | F-005 | Organizer edits own event | Edit the venue of an own event; try the same as another Organizer and as an Attendee. | Owner and Admin: `200`, saved event returned and shown at once. Others: `403`. Only the sent field changes. | `backend/test/events.test.js`, `client/src/test/EditEvent.test.jsx` | Pass (auto) |
| TC-Event-03 | F-006 | Organizer cancels an event | Cancel an event that has bookings, with a reason. | Event status `cancelled`; all its bookings are cancelled; every booked attendee gets an alert; a started or already cancelled event gives `409`. | `backend/test/cancel.test.js`, `client/src/test/CancelEvent.test.jsx` | Pass (auto) |
| TC-Event-04 | F-007 | Event needs capacity, date, venue, price | 1. Publish with a detail missing. 2. Publish with a past date, capacity 0 or a negative price. 3. Save as draft, then complete and publish. | Incomplete or invalid publish gives `400` with an `errors` list; a draft needs only title, description, category; publishing works once all details are valid. | `backend/test/events.test.js` | Pass (auto) |

### 3.3 Search

| ID | Req | Title | Steps | Expected result | Automated in | Status |
|----|-----|-------|-------|-----------------|--------------|--------|
| TC-Search-01 | F-008 | Browse upcoming events | Open Browse events. | Only published, upcoming events, soonest first, with seats left; cancelled, draft and past events are hidden; empty and error states shown. | `backend/test/events.test.js`, `client/src/test/filterEvents.test.js`, `client/src/test/App.test.jsx` | Pass (auto) |
| TC-Search-02 | F-009 | Filter by category, date and location | Filter by each field and by several together; clear the filters. | Only matching events are shown (AND of all filters, venue match is case-insensitive); a "no match" message and a Clear button appear when nothing matches. | `backend/test/events.test.js`, `client/src/test/filterEvents.test.js`, `client/src/test/App.test.jsx` | Pass (auto) |

### 3.4 Booking, payments, notifications, check-in

| ID | Req | Title | Steps | Expected result | Automated in | Status |
|----|-----|-------|-------|-----------------|--------------|--------|
| TC-Book-01 | F-010 | Book a spot | As Attendee, book a free event; book again; book a full, a past and an unknown event. | First booking confirmed with a ticket code. Double booking `409`; full event `400`; past or unknown event refused. | `backend/test/bookings.test.js`, `client/src/test/Booking.test.jsx` | Pass (auto) |
| TC-Book-02 | F-011 | Ticket with QR code | Open My tickets after booking. | The ticket shows the code and a QR image; only my own tickets are listed. | `backend/test/bookings.test.js`, `client/src/test/Booking.test.jsx` | Pass (auto) |
| TC-Book-03 | F-012 | Cancel my registration | Cancel a booking and confirm; cancel again; keep the booking. | Seat released and ticket stops working; cancelling twice or after check-in gives `409`; the UI asks for confirmation first. | `backend/test/bookings.test.js`, `client/src/test/Booking.test.jsx` | Pass (auto) |
| TC-Pay-01 | F-013 | Pay for a paid event | Book a paid event; pay on the gateway page; also try a failed payment and a forged signature. | Booking waits as `pending_payment` (seat held 15 min) and is confirmed only after a verified payment; failed payment releases the seat; forged signature gives `400`. | `backend/test/payments.test.js`, `client/src/test/Payments.test.jsx` | Pass (auto) |
| TC-Pay-02 | F-014 | Receipt after paying | Pay, then open the receipt. | Receipt shows number, amount, event, date and payment reference; receipts exist only for paid payments. | `backend/test/payments.test.js`, `client/src/test/Payments.test.jsx` | Pass (auto) |
| TC-Pay-03 | F-015 | Admin refunds a payment | As Admin, refund an eligible payment; try as Organizer; try a payment for an event that went ahead. | Admin refund works, booking is cancelled and the attendee is alerted; Organizer gets `403`; ineligible refunds give `409`. | `backend/test/payments.test.js`, `client/src/test/Payments.test.jsx` | Pass (auto) |
| TC-Notify-01 | F-016 | Booking confirmation notification | Book an event and look at Alerts. | A "booking confirmed" alert (and email when a provider is set). | none | Not built |
| TC-Notify-02 | F-017 | Event reminder | Wait for the reminder time before an event. | A reminder alert is sent before the event date. | none | Not built |
| TC-Notify-03 | F-018 | Cancellation alert | Cancel an event with bookings (same flow as TC-Event-03). | Every booked attendee gets an in-app alert; email goes out only when `NOTIFY_WEBHOOK_URL` is set, with 3 tries (DEVIATIONS D-32). | `backend/test/cancel.test.js` | Pass (auto) |
| TC-Checkin-01 | F-019 | Scan a ticket to check in | As Organizer or Admin, scan a valid code; scan it again; scan a cancelled, unpaid and unknown code. | First scan: "checked-in" with the attendee. Reuse, cancelled, unpaid and unknown codes give `400`. An Attendee cannot scan (`403`). | `backend/test/bookings.test.js`, `client/src/test/Booking.test.jsx` | Pass (auto) |
| TC-Checkin-02 | F-020 | Show my ticket at the entrance | Open My tickets on a phone near the event. | The ticket code and QR stay visible and scannable. | `client/src/test/Booking.test.jsx` | Pass (auto) |

### 3.5 Dashboard

| ID | Req | Title | Steps | Expected result | Automated in | Status |
|----|-----|-------|-------|-----------------|--------------|--------|
| TC-Dash-01 | F-021 | View registrations | As Organizer, open the registration list of an own event. | The list matches the current bookings. | none | Not built |
| TC-Dash-02 | F-022 | Export attendee list | Download the CSV / Excel file. | The file matches what is shown on screen. | none | Not built |
| TC-Dash-03 | F-023 | Basic analytics | Open the event analytics. | Bookings, revenue and attendance match the actual bookings and payments. | none | Not built |

### 3.6 Non-functional, security and operations

| ID | Req | Title | Steps | Expected result | Automated in | Status |
|----|-----|-------|-------|-----------------|--------------|--------|
| TC-Perf-01 | NF-001 | Response time <= 3 s for 90% of requests | `cd backend && npm run seed:perf && npm run perf` (50 users). | p90 <= 3 s with no errors. | `backend/test/timing.test.js` (timing middleware); script `backend/scripts/perf.js` | Manual: Developer's run of 01-11-2026 passed (p90 12 ms, `docs/PERFORMANCE.md`); repeat on staging |
| TC-Perf-02 | NF-002 / SAD 3.1 | 500 concurrent users | `npm run perf` with 500 users. | p90 <= 3 s, no errors at 500 users. | script `backend/scripts/perf.js` | Manual: Developer's run passed (p90 418 ms, laptop); repeat on staging |
| TC-Sec-01 | SR-001 | TLS 1.2+ only | 1. Start the server with a certificate. 2. Try TLS 1.0, 1.1, 1.2, 1.3. 3. Scan the deployed site. | 1.2 and 1.3 work, 1.0 and 1.1 are refused, HSTS is sent, plain HTTP is redirected behind a proxy. | `backend/test/tls.test.js` | Manual: automated part passes; traffic scan of a deployed system not done yet |
| TC-Sec-02 | SR-002 | No plaintext passwords | Register, then run `npm run audit:passwords` against the database. | Stored value is a bcrypt hash; the audit reports 0 not hashed; passwords never appear in the log. | `backend/test/auth.test.js`, `backend/test/lockout.test.js` | Pass (auto); run the DB audit once on the demo database |
| TC-Sec-03 | SR-003 | No card data stored | Send a request with a card number; run `npm run audit:card-data`. | Request refused with `400`; nothing stored; the audit finds 0 card numbers; logs hold no card data. | `backend/test/cardData.test.js`, `backend/test/payments.test.js`, `backend/test/auditLog.test.js` | Pass (auto); run the DB audit once on the demo database |
| TC-Sec-04 | SR-004 | RBAC blocks Attendees from Organizer / Admin actions | As Attendee, anonymous and Organizer, call create-event, refund and audit-log endpoints. | `401` without a token, `403` for the wrong role; each refusal is logged as `access_denied`. | `backend/test/events.test.js`, `backend/test/auth.test.js`, `backend/test/lockout.test.js`, `backend/test/auditLog.test.js` | Pass (auto) |
| TC-Sec-05 | SR-005 | Account lockout and authentication log | 1. Enter a wrong password 5 times. 2. Try the right password while locked. 3. Wait for the lock to end, log in. 4. Open Audit log as Admin. | 5th wrong attempt gives `423` with `Retry-After`; right password refused during the lock; login works after 15 min and counters reset; register, failed, locked, blocked and successful logins are all in the log; no password or token is logged. | `backend/test/lockout.test.js`, `client/src/test/AuditLog.test.jsx` | Pass (auto) |
| TC-OPS-01 | NF-004 | Logs kept 2+ years, archived, retrievable | Book, pay, check in and cancel; run `npm run logs:archive -- --days 0`; open Audit log. | Each action has a log row with `retainUntil` >= 2 years later; archived rows leave the recent collection only after reaching the archive and stay searchable; only an Admin can read the log; nothing can edit or delete a row. | `backend/test/auditLog.test.js`, `backend/test/auditHooks.test.js`, `client/src/test/AuditLog.test.jsx` | Pass (auto); the real 2-year TTL deletion cannot be demonstrated (DEVIATIONS D-43) |
| TC-UX-01 | NF-005 | Accessibility (WCAG 2.1 AA) | Audit the main pages with a screen reader and a contrast checker. | Labelled fields, keyboard focus, high-contrast mode, no AA failures. | none (Sprint 1 UI has labels, skip link, high-contrast toggle, DEVIATIONS D-12) | Manual: full audit not done |

## 4. Defects found while preparing this document

| ID | Found in | Description | Status |
|----|----------|-------------|--------|
| - | - | No new defects recorded during the automated test execution on 06-11-2026. Unimplemented features and pending manual validations are tracked in the test case statuses. | - |

Add one row per defect found during manual execution (what, where, steps, severity, who fixes).

## 5. Manual execution log (fill in during testing)

| Date | Test case | Tester | Result (Pass / Fail) | Evidence (screenshot, link) | Notes |
|------|-----------|--------|----------------------|-----------------------------|-------|
|      | TC-Sec-01 |        |                      |                             |       |
|      | TC-Sec-02 (DB audit) |  |                    |                             |       |
|      | TC-Sec-03 (DB audit) |  |                    |                             |       |
|      | TC-Perf-01 / 02 (staging) | |                  |                             |       |
|      | TC-UX-01 |        |                      |                             |       |





