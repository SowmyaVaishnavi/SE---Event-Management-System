# Security Validation Report: EMS-NF-003 (#26) and EMS-SR-004 (#32)

**Project:** Event Management System (Team 13)
**Role:** QA Lead, Chinmayee CM
**Date:** 11-11-2026
**Scope:** TC-Sec-01 (EMS-NF-003: sensitive data over HTTPS, no plaintext passwords) and TC-Sec-04 (EMS-SR-004: role-based access control)
**References:** SRS 5 and 5.1.2, SAD 3.9 and 4.4, STP 5.1, `docs/TLS.md`, `docs/SPRINT1_TEST_CASES.md`

## 1. Result summary

| Issue | Requirement | Test case | Result | Evidence |
|-------|-------------|-----------|--------|----------|
| #26 | EMS-NF-003 | TC-Sec-01 | **Pass (automated)**, one defect found and fixed (F-1). Manual items in section 5 still open. | `backend/test/nf003.test.js` (7 tests), `backend/test/tls.test.js` (3), `backend/test/auth.test.js` |
| #32 | EMS-SR-004 | TC-Sec-04 | **Pass (automated)** | `backend/test/rbac.test.js` (29 tests) |

**Runs (Node 22, clean checkout, `JWT_SECRET=ci-only-secret`):**

| Command | Before this work | After this work |
|---------|------------------|-----------------|
| `cd backend && npm test` | 79 tests, 79 pass | **115 tests, 115 pass, 0 fail, 0 skipped** |
| `cd client && npm test` | 52 tests, 52 pass | 52 tests, 52 pass (unchanged) |

**The new tests can fail.** To confirm they are not passing by accident, the role checks on `POST /api/events` and `POST /api/payments/:id/refund` were removed temporarily: 5 of the 29 RBAC tests failed. With the new error handler removed from the test app, 2 of the 7 NF-003 tests failed. Both changes were then restored.

## 2. TC-Sec-01 (EMS-NF-003): what is checked

Requirement (SRS 5): sensitive user and payment data is sent over HTTPS; passwords are never stored in plaintext. Related: SR-001 (TLS 1.2+), SR-002 (bcrypt), SR-003 (no card data).

| Check | Test | Expected | Result |
|-------|------|----------|--------|
| Register, login and `/me` responses hold no password, hash, lockout counters; JWT carries only id and role | `nf003.test.js` 1 | Nothing secret in any response | Pass |
| Stored password is a bcrypt hash; same password gives different hashes; schema has `select: false` | `nf003.test.js` 2 | Hash only, salted, not selected by default | Pass |
| No save path stores plaintext, including a later password change; no double hashing | `nf003.test.js` 3 | Always a fresh bcrypt hash | Pass |
| Passwords never appear in the audit trail or server logs (register, login ok, wrong password, password typed in the name box, unknown user, malformed JSON, oversized body) | `nf003.test.js` 4 | No plaintext or hash anywhere | Pass (after F-1 fix) |
| Error responses never echo the password, never show a stack trace or database error; wrong password and unknown user give the same message | `nf003.test.js` 5 | Safe 4xx JSON | Pass (after F-1 fix) |
| `REQUIRE_HTTPS`: login and sign-up over plain HTTP are refused (403) before the handler runs; GET is redirected (308) to `https://`; no HSTS on plain HTTP | `nf003.test.js` 6 | Credentials never processed over HTTP | Pass |
| Behind a TLS proxy (`X-Forwarded-Proto: https`): request accepted, HSTS sent | `nf003.test.js` 7 | 201 and `Strict-Transport-Security` | Pass |
| TLS 1.2 and 1.3 accepted, TLS 1.0 and 1.1 refused, HSTS, `REQUIRE_HTTPS` redirect | `tls.test.js` (existing) | As stated | Pass (ran with OpenSSL available) |
| bcrypt on sign-up, lockout, card data refused | `auth.test.js`, `lockout.test.js`, `cardData.test.js` (existing) | As stated | Pass |

## 3. TC-Sec-04 (EMS-SR-004): role-based access matrix

Tested against the real routers. Cells show what the test expects.

| Endpoint | Attendee | Organizer (owner) | Organizer (not owner) | Admin | No token |
|----------|----------|-------------------|-----------------------|-------|----------|
| `POST /api/events` | 403 | allowed (201) | allowed (201) | allowed (201) | 401 |
| `GET /api/events/mine` | 403 | allowed | allowed (own events) | allowed (all) | 401 |
| `PUT /api/events/:id` | 403 | allowed (200) | **403** | allowed (200) | 401 |
| `POST /api/events/:id/cancel` | 403 | allowed (200) | **403** | allowed (200) | 401 |
| `POST /api/checkin/scan` | 403 | allowed | allowed (see F-2) | allowed | 401 |
| `POST /api/events/:id/register` | allowed | **403** | **403** | **403** | 401 |
| `GET /api/payments` | 403 | 403 | 403 | allowed (200) | 401 |
| `POST /api/payments/:id/refund` | 403 | 403 | 403 | allowed | 401 |
| `GET /api/audit-logs`, `/status` | 403 | 403 | 403 | allowed (200) | 401 |
| `GET /api/health/metrics` | 403 | 403 | 403 | allowed (200) | 401 |

Additional checks (all pass):

- A refused create, edit, cancel or refund changes nothing: no event created or edited, status unchanged, no cancellation alerts sent, payment stays `paid`.
- The role is taken only from the signed token. A body containing `role: "Admin"` does not change the result.
- Refused tokens (401): `alg: none`, wrong secret, payload edited with the old signature, expired, unknown role, missing user id, HS512, garbage, and the `Basic` scheme.
- An attendee cannot read another user's payment receipt (same 404 as "not found", so ids cannot be probed).
- Every refused action is written to the audit log as `access_denied` with user, role, method and path, and the token is never logged.

## 4. Findings

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| F-1 | **Passwords could reach the server log and error pages.** `server.js` had no error handler. When a login request body was not valid JSON, Express's default handler (a) sent an HTML page with a stack trace and (b) printed the whole error to stderr, including the raw request body with the typed password (reproduced with `NODE_ENV` unset). This breaks "no plaintext passwords" in practice and SAD 4.4 (no sensitive info in logs, safe error messages). | Medium | **Fixed.** New `backend/lib/errorHandler.js`, mounted last in `server.js`. Returns plain JSON, logs only the error name. Covered by `nf003.test.js` 4 and 5. |
| F-2 | **Any Organizer can scan any event's ticket** (`POST /api/checkin/scan` checks the role but not that the organizer owns the ticket's event). SRS 4.7 says "an Organizer or Admin can scan a ticket", so this follows the SRS. The risk is one organizer checking in attendees of another organizer's event. | Low | **Open, Product Owner decision.** Add an owner check (Admin exempt) if the team wants it, and record it in `DEVIATIONS.md`. |
| F-3 | **No rate limiting on the API.** SAD 3.9 (STRIDE, Denial of service) lists "rate limiting on API endpoints". The code has login lockout only. | Low | **Open, Developer.** Not part of #26 or #32. |
| F-4 | Admin cannot book a spot (`register` is Attendee only). Not stated in the SRS. | Info | Behaviour is tested as intended. Confirm and note in `DEVIATIONS.md`. |

## 5. Not done in this report (needs a running system)

| Item | How | Why it is pending |
|------|-----|-------------------|
| DB audit for plaintext passwords | `cd backend && npm run audit:passwords` against the demo database. Expect "0 not hashed". | Needs MongoDB with real data. |
| DB audit for card data | `npm run audit:card-data`. Expect "0 with card data". | Same. |
| Traffic scan of a deployed site | `npm run check:tls` / `nmap --script ssl-enum-ciphers -p 443 <host>`. Expect TLS 1.2 and 1.3 only. | The app is not deployed yet (see `docs/DEMO_GUIDE.md`). |
| Check that production runs over HTTPS | Set `REQUIRE_HTTPS=true` and `TRUST_PROXY=1` (or the TLS cert variables) and `NODE_ENV=production`. | Deployment setting, see `docs/TLS.md`. |

Record the results of these four checks here once they are run:

| Check | Date | Result | Evidence |
|-------|------|--------|----------|
| `npm run audit:passwords` | | | |
| `npm run audit:card-data` | | | |
| TLS scan of deployed site | | | |

## 6. How to re-run

```
cd backend
JWT_SECRET=ci-only-secret npm test                       # whole suite
JWT_SECRET=x node --test test/rbac.test.js               # TC-Sec-04
JWT_SECRET=x node --test test/nf003.test.js              # TC-Sec-01 (NF-003)
```
