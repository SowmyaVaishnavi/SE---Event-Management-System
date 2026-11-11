# Demo guide: presenting the Developer's features

For the Sprint 1 demo and for screenshots. Covers every Developer issue: #1 to #7, #13 to #15, #24, #29, #30, #31.
Setup from a fresh clone is in the root `README.md`. This guide assumes MongoDB is running.

## 1. Get ready (5 minutes, do it on the day)

Event dates in the demo data are relative to today, so seed again on the day you present.

**Terminal 1: backend**

```bash
cd backend
npm run seed:demo
npm start
```

`seed:demo` prints the demo logins (an Admin, an Organizer and two Attendees; the password is set at the top of `backend/scripts/seed-demo.js`). Wait for `MongoDB connected successfully`.

**Terminal 2: frontend**

```bash
cd client
npm run dev
```

Open **http://localhost:5173**.

**Use two browser windows.** The login is stored per browser profile, so a normal window and a private/incognito window can be signed in as two different people at the same time (for example Organizer in one and Attendee in the other). This makes the cancel and refund steps quick, because you can show the attendee's alert without logging out and in.

Re-running `npm run seed:demo` resets the demo accounts and events (and removes their bookings and payments), so you can rehearse and start clean.

## 2. The demo, issue by issue (about 10 minutes)

Use the usernames printed by `seed:demo`: `admin`, `organizer`, `ravi` and `meera` (the email also works).

| # | Issue | Do this | What it shows |
|---|-------|---------|---------------|
| #1 | F-001 Sign-up | Log out. **Register** a new account as Attendee, then log in with it | Account created and can log in right after |
| #2 | F-002 Login | Log in as `ravi`. Then log out and try a wrong password | Correct login works; wrong login shows "Invalid username/email or password" |
| #3 | F-003 Roles | Compare the menus: Attendee has no Create event; Organizer has Create event, My events, Check-in; Admin also has Payments | Each role only sees its own features. To show the error itself, see "Role error" below |
| #4 | F-004 Create event | As `organizer`: **Create event**, fill every field, submit. Open **Browse events** | The new event appears in the event list |
| #7 | F-007 Capacity, date, venue, price | In **Create event** set the date to yesterday and submit. Then clear the venue and submit | The server refuses a past date; the browser blocks an empty venue. An event can't be published without them |
| #5 | F-005 Edit event | **My events**, **Edit** on one event, change the venue, **Save changes** | "Changes saved." and the new venue shows right away. Another organizer can't edit it |
| #6 | F-006 Cancel event | As `ravi` and `meera` book **Inter-Department Cricket** (free). As `organizer`: **My events**, **Cancel event**, type a reason, confirm. As `ravi`: **Alerts** and **My tickets** | Event is cancelled, both attendees get an alert with the reason, and their tickets are cancelled |
| #13 | F-013 Payment | As `ravi`, book **Cultural Fest: Music Night** (₹499.50). The booking shows **Payment pending** with a seat held for 15 minutes. Click **Pay ₹499.50** | The booking is only confirmed once the payment succeeds. Then book the ₹250 **Full-Stack Web Workshop** and click **Simulate a failed payment**: the booking is not confirmed and the seat is released |
| #14 | F-014 Receipt | Under **My tickets**, **View receipt** | Receipt with the right amount, event and date (and **Print / save as PDF**) |
| #15 | F-015 Refund | As `admin`: **Payments**, **Refund** on Ravi's payment, add a reason, confirm. As `ravi`: **Alerts** | Only an Admin can refund (the Organizer has no Payments page). The attendee is told "Refund completed" |

**Role error (#3).** Log in as an Attendee, open the browser developer tools (F12), **Console**, and paste this. Chrome may ask you to type `allow pasting` first.

```js
fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.ems_token }, body: '{}' }).then(r => r.json().then(b => console.log(r.status, b)))
```

It prints `403` and "You do not have access to this action. It is for Organizer or Admin accounts only".

## 3. The security and performance requirements (terminal)

Run these in `backend` while the demo database is in use. Each is one screenshot.

**#30 bcrypt: no plaintext passwords in the database (TC-Sec-02)**

```bash
npm run audit:passwords
```

Expect `... bcrypt hashes, 0 not hashed`. To show the hashes themselves, open the database in MongoDB Compass (`mongodb://localhost:27017`, database `ems`, collection `users`): every `password` starts with `$2b$12$`.

**#31 no card data stored (TC-Sec-03)**

```bash
npm run audit:card-data
```

Expect `0 with card data`. Also worth saying: card numbers are only ever typed on the payment provider's page, and the API refuses any request that contains one.

**#29 TLS 1.2+ (TC-Sec-01).** Start a second copy of the API with HTTPS. In `backend`:

```bash
npm run cert:dev
```

Then, in a new terminal in `backend` (PowerShell):

```powershell
$env:PORT = '5443'; $env:TLS_CERT_FILE = 'certs/localhost.crt'; $env:TLS_KEY_FILE = 'certs/localhost.key'; $env:HTTP_REDIRECT_PORT = '5080'; npm start
```

and in a third terminal in `backend`:

```bash
npm run check:tls -- --port 5443 --http-port 5080
```

Expect TLS 1.0 and 1.1 `REFUSED`, TLS 1.2 and 1.3 `ACCEPTED`, an HSTS header, a redirect from plain HTTP, and `Result: PASS`. The certificate is self-signed for the demo; a real deployment uses a real certificate (`docs/TLS.md`).

**#24 response time (TC-Perf-01).** Show the recorded results in `docs/PERFORMANCE.md` (p90 of 12 ms at 50 users and 418 ms at 500 users, against a 3,000 ms target). To run it live, use a **separate database**, because the test adds 200 events:

```powershell
$env:MONGO_URI = 'mongodb://127.0.0.1:27017/ems_perf'; npm run seed:perf; npm start
```

then in another terminal in `backend`:

```bash
npm run perf -- --url http://localhost:5000 --users 50 --seconds 30
```

It ends with `Result: 90th percentile ... ms vs target 3000 ms ... PASS`. The live health numbers are also at `/api/health/metrics` (Admin).

## 4. Points to be honest about (likely questions)

- **Payments use a built-in test gateway.** No real money moves. Razorpay (test mode) is supported by adding keys to `.env`; see `docs/PAYMENTS.md`.
- **Alerts are in-app.** Email goes out only if an email provider is configured (`NOTIFY_WEBHOOK_URL`); SMS is not built.
- **TLS is shown on the local server.** It is not deployed anywhere yet, so the final "traffic scan" of the live site (TC-Sec-01) is for Sprint 2.
- **Performance was measured on one laptop.** To be repeated on the hosted server. A burst of 500 logins in 5 seconds makes the logins themselves slow (up to 17 s) because of bcrypt; other pages stay fast. See `docs/PERFORMANCE.md`.
- Every difference from the SRS and SAD is listed in `docs/DEVIATIONS.md` (D-23 to D-39 are the Developer's).

## 5. If something goes wrong

| Problem | Fix |
|---------|-----|
| `Startup error: connect ECONNREFUSED 127.0.0.1:27017` | MongoDB isn't running. Start the MongoDB service (Windows: Services, MongoDB Server, Start) or use an Atlas `MONGO_URI` |
| `MONGO_URI is missing` or `JWT_SECRET is missing` | Create `backend/.env` from `.env.example` (`copy .env.example .env`) |
| The page loads but every request fails ("Cannot connect to backend server") | The backend isn't running on port 5000. Check terminal 1 |
| `EADDRINUSE` (port in use) | Something else is on that port. Close the old terminal, or set `PORT` in `.env` and `VITE_API_TARGET` for the frontend |
| Login says "Invalid username/email or password" for a demo account | Run `npm run seed:demo` again against the same database the backend uses |
| Events missing from Browse events | They are dated 5 to 30 days ahead; an old seed has expired events. Run `npm run seed:demo` again |
| `Event full` or `Payment pending` when rehearsing again | Run `npm run seed:demo` to reset |
