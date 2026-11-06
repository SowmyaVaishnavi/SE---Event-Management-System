# Unit Test Report

**Project:** Event Management System (EMS)
**Team:** 13
**Prepared by:** Dhanyashree K. M.
**SRN:** PES2UG24CS156
**Role:** Test Engineer
**Execution date:** 06-11-2026
**Branch:** `dhanyashree-sprint2-qa`

## 1. Objective

The objective of this report is to document the automated backend and frontend test execution performed for the Event Management System during Sprint 2 and Part-3 testing.

## 2. Test Environment

| Component | Tool / Version |
|---|---|
| Operating system | Windows |
| Runtime | Node.js v24.22.1 |
| Backend framework | Node.js / Express |
| Backend test runner | Node.js built-in test runner (`node --test`) |
| Frontend framework | React 18.3.1 |
| Frontend build/test tool | Vite 5.4.0 |
| Frontend test runner | Vitest 2.1.9 |
| DOM environment | jsdom |
| UI testing | React Testing Library |
| Accessibility testing | vitest-axe |

## 3. Backend Test Execution

**Command:** `npm --prefix backend test`

| Metric | Result |
|---|---:|
| Test files | 11 |
| Total tests | 79 |
| Passed | 78 |
| Failed | 0 |
| Skipped | 1 |

Backend tests cover authentication, password handling, role-based access, event management, bookings, cancellation, notifications, payments, refunds, audit logging, account lockout, timing and TLS-related behaviour.

**Observation:** One TLS server test was skipped because OpenSSL was unavailable in the test environment. No backend test failures were reported.

## 4. Frontend Test Execution

**Command:** `npm --prefix client test`

| Metric | Result |
|---|---:|
| Test files | 8 |
| Total tests | 52 |
| Passed | 52 |
| Failed | 0 |
| Skipped | 0 |

Frontend tests cover application rendering, event filtering, booking, event cancellation, event editing, payments, audit-log UI and accessibility checks.

## 5. Overall Test Results

| Metric | Backend | Frontend | Overall |
|---|---:|---:|---:|
| Test files | 11 | 8 | 19 |
| Total tests | 79 | 52 | 131 |
| Passed | 78 | 52 | 130 |
| Failed | 0 | 0 | 0 |
| Skipped | 1 | 0 | 1 |

**Overall pass rate:** 100% of executed tests passed (130 passed out of 130 executed). One additional backend test was skipped.

## 6. Result Analysis

- All executed backend tests passed.
- All frontend tests passed.
- No automated test failures were observed.
- The skipped TLS test requires an environment with OpenSSL available for execution.
- Passing automated tests do not establish that every requirement in the Software Test Plan has been fully validated. Manual, staging and operational checks remain separately tracked in the System Validation Report.

## 7. Conclusion

The automated test execution completed successfully with 130 passed tests, zero failures and one skipped backend test. The results provide evidence that the tested backend and frontend behaviours are functioning as expected in the available test environment.

## 8. Limitations

- The TLS server test was skipped because OpenSSL was unavailable.
- Automated tests do not replace complete system-level, user acceptance, performance, accessibility and production-environment validation.
- Third-party notification delivery and long-term operational requirements need separate verification.

---

**Prepared by:**  
Dhanyashree K. M.  
PES2UG24CS156
