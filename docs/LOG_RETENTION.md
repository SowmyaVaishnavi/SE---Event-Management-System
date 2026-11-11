# Audit log, account lockout and log retention (EMS-SR-005, EMS-NF-004)

Owner: Product Owner. Test cases: **TC-Sec-05** (lockout, auth events) and **TC-OPS-01** (retention, archive, retrieval).
Design: SAD 3.9 (Repudiation: audit logging without sensitive credentials; Spoofing: account lockout), SAD 4.4 (no sensitive info in logs).

## 1. What is logged

| Category | Actions |
|----------|---------|
| `auth` | `register_success`, `register_rejected`, `login_success`, `login_failed`, `account_locked`, `login_blocked`, `access_denied` (a 403 from a role check) |
| `event` | `event_created`, `event_updated`, `event_cancelled` |
| `booking` | `booking_held`, `booking_confirmed`, `booking_cancelled`, `checkin_success`, `checkin_refused` (unknown, used, cancelled or unpaid ticket) |
| `payment` | `payment_paid`, `payment_failed`, `payment_verification_failed`, `payment_paid_no_seat`, `payment_refunded` |

Each row holds: when, category, action, result (`success` / `failure` / `denied`), who (user id, role), the username or email typed at login, IP address, a target such as `event:<id>`, and a small `detail` object.

**Never logged:** passwords (right or wrong), tokens, signatures, ticket codes, card numbers. `lib/auditLog.js` removes any field whose name looks secret and any text that looks like a card number. A login name is stored only if it looks like a username or email (people sometimes paste a password into that box).

Logging is not awaited by the routes and never throws, so a logging problem cannot undo a booking or a payment, and response times (NF-001) are not affected.

## 2. Account lockout (SR-005)

```
wrong password  -> failedLoginAttempts + 1 (atomic)         -> 401
5th wrong in a row -> lockUntil = now + 15 min, counter = 0 -> 423 + Retry-After
login while locked (any password)                           -> 423, password not checked
correct password before the limit, or after the lock ended  -> counters reset                -> 200
```

Settings in `backend/.env`: `LOGIN_MAX_ATTEMPTS` (5), `LOGIN_LOCK_MINUTES` (15). Wrong passwords only count when they are **in a row**. An account that does not exist is never locked and always gets `401` (see DEVIATIONS D-41).

To unlock a person at once (demo or support), clear the lock in MongoDB:

```js
db.users.updateOne({ username: "asha_k" }, { $set: { lockUntil: null, failedLoginAttempts: 0 } })
```

## 3. Retention, archive and retrieval (NF-004)

```
write -> auditlogs (recent) --daily job, rows older than 90 days--> auditlogarchive
              |                                                          |
              +---- both collections: deleted only after retainUntil (written date + 2 years) ----+
```

- **Kept 2 years.** Every row gets `retainUntil = written date + 2 calendar years` (never fewer than 730 days). `LOG_RETENTION_YEARS` can raise it, never lower it. A MongoDB TTL index on `retainUntil` removes a row only after that date. The archive keeps the same `retainUntil`: archiving never shortens or restarts retention.
- **Archive.** The server runs `archiveOldLogs()` 30 seconds after start and then every `LOG_ARCHIVE_INTERVAL_HOURS` (24). It copies old rows to `auditlogarchive` and removes them from `auditlogs` **only after confirming they reached the archive**. It is safe to run again (a repeated or interrupted run never duplicates or loses a row). Run it by hand: `npm run logs:archive` (optionally `-- --days 30`).
- **Retrieval.** `GET /api/audit-logs` (Admin) searches recent and archived rows together, newest first, with filters and paging. The **Audit log** page in the app uses it. `GET /api/audit-logs/status` shows the counts, the oldest row and the retention setting (evidence for TC-OPS-01).
- **Read-only.** No route edits or deletes a log row.
- **Production note.** If the database is hosted on MongoDB Atlas, Atlas Online Archive can replace the second collection; the `retainUntil` rule stays the same.

Settings in `backend/.env`: `LOG_RETENTION_YEARS` (2), `LOG_ARCHIVE_AFTER_DAYS` (90), `LOG_ARCHIVE_INTERVAL_HOURS` (24, `0` = do not run the job).

## 4. How to check it (TC-Sec-05, TC-OPS-01)

Automated: `cd backend && npm test` runs `lockout.test.js` (TC-Sec-05), `auditLog.test.js` and `auditHooks.test.js` (TC-OPS-01); `cd client && npm test` runs `AuditLog.test.jsx`.

Manual demo:

1. Log in with a real account and a wrong password 5 times. The 5th answer is **423** and the page says when to try again. The right password is refused for 15 minutes.
2. Log in as an Admin (`npm run create-admin`), open **Audit log**: `login_failed` x4, `account_locked`, `login_blocked`, and your own `login_success` are listed.
3. Book, pay, check in and cancel an event; filter the Audit log by **Bookings** / **Payments** / **Events**.
4. `npm run logs:archive -- --days 0` moves everything to the archive; the Audit log page still shows every row, marked **archived**, and the counts on the page change from recent to archived.
5. In `mongosh`: `db.auditlogs.getIndexes()` shows the `retainUntil` TTL index (`expireAfterSeconds: 0`), and `db.auditlogs.findOne()` shows `retainUntil` two years after `occurredAt`.
