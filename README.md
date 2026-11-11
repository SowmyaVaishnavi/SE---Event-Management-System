# Event Management System (EMS), Team 13

Web app for organizers to create and manage events, and for attendees to browse, book, pay and check in.
Stack (SRS 2): **React (Vite)** frontend in `client/`, **Node.js + Express** API in `backend/`, **MongoDB** database.

## Run it on your computer

You need: **Git**, **Node.js 20 or newer** (`node -v`), and **MongoDB Community Server** running on `localhost:27017`
(the Windows installer runs it as a service; or use a free MongoDB Atlas database and put its URI in `.env`).

```bash
git clone https://github.com/SowmyaVaishnavi/SE---Event-Management-System.git
cd SE---Event-Management-System
```

**1. Backend** (terminal 1)

```bash
cd backend
npm install
copy .env.example .env
```

Open `backend/.env` and set `JWT_SECRET` to any long random text (the API refuses to start without it). `MONGO_URI` already points at a local MongoDB.

```bash
npm run seed:demo
npm start
```

`seed:demo` creates demo accounts (Admin, Organizer, two Attendees) and six upcoming events, and prints the logins.
`npm start` should print `MongoDB connected successfully` and `Server running on http://localhost:5000`.

(On macOS or Linux use `cp .env.example .env` instead of `copy`.)

**2. Frontend** (terminal 2)

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173**. The dev server forwards `/api` to the backend on port 5000.
`npm run dev:mock` runs the frontend alone with sample events, for a quick look without the backend.

**3. Tests**

```bash
cd backend && npm test      # API tests, no database needed
cd client && npm test       # UI tests
```

## Roles

| Role | Can do |
|------|--------|
| Attendee | Browse and filter events, book (and pay for) a spot, see tickets with QR code, cancel a booking, view receipts and alerts |
| Organizer | Create, edit and cancel their own events, see them under **My events**, check attendees in, view alerts |
| Admin | Everything an Organizer can do, plus see all payments and issue refunds |

Sign-up offers Attendee or Organizer only. Admin accounts are created on the server (`npm run create-admin`, or `npm run seed:demo` for the demo).

## Features and where they live

| Requirement | What | Test case | Docs |
|-------------|------|-----------|------|
| F-001, F-002 | Sign-up, login with username or email | TC-Auth-01, TC-Auth-02 | `docs/API_CONTRACT.md` |
| F-003, SR-004 | Role-based access | TC-Auth-03, TC-Sec-04 | `docs/API_CONTRACT.md` |
| F-004, F-005, F-007 | Create and edit events, capacity, date, venue, price | TC-Event-01, 02, 04 | `docs/API_CONTRACT.md` |
| F-006, F-018 | Cancel an event, alert everyone booked | TC-Event-03 | `docs/API_CONTRACT.md` |
| F-008, F-009 | Browse and filter upcoming events | TC-Search-01, 02 | `docs/API_CONTRACT.md` |
| F-010 to F-012, F-019, F-020 | Booking, QR ticket, cancel booking, check-in | TC-Book-01 to 03, TC-Checkin-01, 02 | `docs/API_CONTRACT.md` |
| F-013, F-014, F-015, SR-003 | Payment, receipt, Admin refund, no card data | TC-Pay-01 to 03, TC-Sec-03 | `docs/PAYMENTS.md` |
| SR-001 | TLS 1.2+ | TC-Sec-01 | `docs/TLS.md` |
| SR-002 | bcrypt password hashing | TC-Sec-02 | `docs/API_CONTRACT.md` |
| NF-001 | Response time 3 s for 90% of requests | TC-Perf-01 | `docs/PERFORMANCE.md` |

## Documents

- `Event_Management_System_SRS.md`: requirements. `EMS-SAD.md`: architecture. `Test_plan_EMS.md`: test plan.
- `docs/DEMO_GUIDE.md`: **step-by-step guide for presenting and demonstrating everything**
- `docs/API_CONTRACT.md`: every API endpoint
- `docs/DEVIATIONS.md`: where the build differs from the SRS, SAD or test plan, and why
- `docs/PAYMENTS.md`, `docs/TLS.md`, `docs/PERFORMANCE.md`: write-ups for the payment, security and performance requirements

## Optional settings (`backend/.env`, all in `.env.example`)

| Setting | Effect |
|---------|--------|
| `TLS_CERT_FILE`, `TLS_KEY_FILE` | The API serves HTTPS with TLS 1.2+ only (`npm run cert:dev` makes a local certificate) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Use Razorpay (test keys) instead of the built-in test payment gateway |
| `NOTIFY_WEBHOOK_URL` | Also send alerts by email through an email provider |

Without them the app works fully on one computer: payments use the built-in test gateway (no real money) and alerts show under **Alerts** in the app.
