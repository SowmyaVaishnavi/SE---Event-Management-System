# Response time (EMS-NF-001, TC-Perf-01)

Owner: Developer. Requirement: page load and API response time **<= 3 s for 90% of requests under normal load** (SRS 5; target agreed in DEVIATIONS D-01). SAD 3.1 adds a goal of **up to 500 concurrent users**.

## Result (2026-11-01)

| Run | Users | Arrival | Requests | Errors | p50 | **p90** | p95 | Max | Result |
|-----|------:|---------|---------:|-------:|----:|--------:|----:|----:|--------|
| Normal load | 50 | over 5 s | 2,334 | 0 | 7 ms | **12 ms** | 13 ms | 266 ms | PASS |
| SAD peak, normal arrival | 500 | over 60 s | 39,764 | 0 | 150 ms | **418 ms** | 473 ms | 697 ms | PASS |
| SAD peak, login storm | 500 | all within 5 s | 7,236 | 0 | 421 ms | **741 ms** | 13.0 s | 17.0 s | PASS overall (logins slow, see below) |

Raw results: `docs/perf/tc-perf-01-50-users.json`, `tc-perf-01-500-users-ramp60.json`, `tc-perf-01-500-users-storm.json`.

**Environment:** one Node.js 24.11 API process and MongoDB 8.2 on the same Windows 11 laptop (Intel Core Ultra 7 255H, 16 cores, 31 GB RAM). The load generator ran on the same machine. This is **not** a production-like environment: there is no network latency to a hosted database and nothing else shares the CPU. The run must be repeated on the deployed staging server for the final TC-Perf-01 sign-off (Sprint 2).

**Data:** 200 upcoming events, 200 attendees, 1,000 bookings (`npm run seed:perf`).

**Request mix per virtual user:** one login, then until the time ends, with 0.2-1 s "think time" between clicks:

| Request | Share |
|---------|------:|
| Browse events | 45% |
| Filter events | 20% |
| Open one event | 15% |
| My tickets | 10% |
| Alerts | 10% |

## What was changed to get there

1. **Password hashing moved off the main thread.** The first 50-user run had an overall p90 of 14 ms, but **logins took 6.5-9.6 s**, and every other request stalled for up to 7 s while they ran. bcrypt (SR-002, cost 12, about 250 ms per check) ran on Node's single main thread, so 50 logins at once blocked the whole API. bcrypt now runs on a pool of worker threads (`backend/lib/passwords.js`, `bcryptWorker.js`): one per spare CPU core, at most 8 by default (`BCRYPT_THREADS`).

   | 50 users | Login p90 | Worst request |
   |----------|----------:|--------------:|
   | Before | 8,194 ms | 9,601 ms |
   | After | 259 ms | 266 ms |

2. **Indexes for the hot queries:** events `{ status, date }` (browse), bookings `{ event, status }` (seat counts and `registeredCount`).
3. Existing choices that help: `.lean()` reads, one aggregate for all `registeredCount` values, a 10 kB JSON body limit, and emails sent in the background so they never delay a response.

## Known limit: login storms

In the storm run, 500 people log in within the same 5 seconds. Other pages stay fast (p90 under 0.8 s), but **the logins themselves wait up to 17 s**. The API can check about **32 logins per second** (8 threads x ~4 per second), so 500 logins take about 16 s to clear.

This is the cost of the bcrypt work factor that SR-002 requires, and it is not "normal load": a login token is valid for a day, so users do not log in on every visit. If a real event needs it (for example, a ticket release at a fixed time):

- run the API on more cores or more instances (the SAD's layered design allows horizontal scaling behind a load balancer), or raise `BCRYPT_THREADS`
- or lower the bcrypt cost to 11 (half the time; still above the OWASP minimum of 10)

This is recorded as DEVIATIONS D-39.

## Monitoring in the running system

- Every API response carries `Server-Timing: app;dur=<ms>` (visible in the browser's DevTools Network tab).
- Requests slower than 1 s (`SLOW_REQUEST_MS`) are logged as `Slow request: GET /api/events 200 1234 ms`. Bodies and query strings are never logged.
- `GET /api/health` (public) returns the API and database status, for uptime checks (NF-002).
- `GET /api/health/metrics` (Admin) returns p50/p90/p95/max per route over the last 1,000 requests, and `meetsTarget` against 3 s.

## How to run TC-Perf-01

```bash
cd backend
npm run seed:perf
npm start
```

In a second terminal:

```bash
cd backend
npm run perf -- --url http://localhost:5000 --users 50 --seconds 30
```

```bash
cd backend
npm run perf -- --url http://localhost:5000 --users 500 --seconds 90 --ramp 60 --report ../docs/perf/my-run.json
```

The script prints a table per request type and **PASS** / **FAIL** against p90 <= 3,000 ms with zero errors, and exits with code 1 on FAIL. Remove the test data afterwards with `npm run seed:perf -- --clean`. Never run the seed against the production database (it refuses when `NODE_ENV=production`).
