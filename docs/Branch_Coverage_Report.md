# Branch Coverage Report

**Project:** Event Management System (EMS)
**Team:** 13
**Prepared by:** Dhanyashree K. M.
**SRN:** PES2UG24CS156
**Role:** Test Engineer
**Execution date:** 06-11-2026
**Branch:** `dhanyashree-sprint2-qa`

## 1. Objective

The objective of this report is to evaluate branch coverage in the Event Management System. Branch coverage measures whether the possible outcomes of conditional decisions in the application code have been executed by the automated tests.

## 2. Tools and Execution

| Component | Tool | Command |
|---|---|---|
| Backend | Node.js built-in coverage | `npm --prefix backend test -- --experimental-test-coverage` |
| Frontend | Vitest V8 coverage | `npm --prefix client test -- --coverage` |

## 3. Backend Branch Coverage

**Overall backend branch coverage: 82.82%**

Examples of module-level branch coverage:

| Module | Branch coverage |
|---|---:|
| `lib/auditLog.js` | 84.21% |
| `lib/cardData.js` | 94.74% |
| `lib/eventFields.js` | 87.18% |
| `lib/lockout.js` | 100.00% |
| `lib/notify.js` | 95.65% |
| `lib/passwords.js` | 76.47% |
| `lib/paymentGateway.js` | 80.95% |
| `lib/tls.js` | 75.00% |
| `middleware/auth.js` | 100.00% |
| `middleware/timing.js` | 72.73% |
| `routes/auditLogs.js` | 82.35% |
| `routes/authRoutes.js` | 80.33% |
| `routes/bookings.js` | 83.33% |
| `routes/events.create.js` | 86.96% |
| `routes/events.js` | 86.61% |
| `routes/health.js` | 50.00% |
| `routes/notifications.js` | 80.00% |
| `routes/payments.js` | 70.54% |

### Backend analysis

- Authentication middleware and account lockout achieved 100% branch coverage.
- The card-data, notification helper and event-field modules achieved strong branch coverage.
- The health route has 50% branch coverage.
- Payment routes have 70.54% branch coverage.
- Additional tests can improve uncovered conditional paths in timing, payment, authentication and audit-log modules.

## 4. Frontend Branch Coverage

**Overall frontend branch coverage: 70.27%**

Examples of module-level branch coverage:

| Module | Branch coverage |
|---|---:|
| `App.jsx` | 85.00% |
| `config.js` | 100.00% |
| `src/api/auditLogs.js` | 66.66% |
| `src/api/bookings.js` | 33.33% |
| `src/api/events.js` | 18.18% |
| `src/api/mockEvents.js` | 100.00% |
| `src/api/payments.js` | 63.15% |
| `AdminPayments.jsx` | 67.85% |
| `Alerts.jsx` | 65.38% |
| `AuditLog.jsx` | 100.00% |
| `AuthPage.jsx` | 92.85% |
| `CheckIn.jsx` | 82.60% |
| `CreateEvent.jsx` | 55.55% |
| `EventCard.jsx` | 81.25% |
| `EventFilters.jsx` | 100.00% |
| `EventList.jsx` | 83.33% |
| `Login.jsx` | 63.63% |
| `MyEvents.jsx` | 44.92% |
| `MyTickets.jsx` | 82.45% |
| `PaymentPanel.jsx` | 60.00% |
| `Receipt.jsx` | 33.33% |
| `Register.jsx` | 33.33% |
| `useEvents.js` | 85.71% |
| `filterEvents.js` | 86.48% |

### Frontend analysis

- `AuditLog.jsx`, `EventFilters.jsx` and `config.js` achieved 100% branch coverage.
- The events API module has 18.18% branch coverage.
- Booking API and registration components have 33.33% branch coverage.
- MyEvents and Receipt components also have conditional paths that need additional testing.
- More tests should cover error responses, missing data, empty states and alternate user actions.

## 5. Overall Branch Coverage Summary

| Component | Branch coverage |
|---|---:|
| Backend | 82.82% |
| Frontend | 70.27% |

The backend and frontend values are reported separately. They are not combined into a single percentage.

## 6. Recommendations

1. Add tests for alternate API responses and error-handling branches.
2. Improve branch coverage for event, booking and payment API modules.
3. Add tests for registration and receipt component conditions.
4. Exercise additional health-route and payment-route outcomes.
5. Review uncovered conditional paths and determine whether they represent missing test scenarios or environment-dependent code.
6. Re-run both coverage commands after adding tests.

## 7. Conclusion

The backend achieved 82.82% branch coverage, while the frontend achieved 70.27%.

The results show that the automated tests exercise many decision paths, particularly in authentication and several core components. However, additional testing is recommended for API error handling, registration, payment and event-related conditional behaviour.

---

**Prepared by:**  
Dhanyashree K. M.  
PES2UG24CS156

