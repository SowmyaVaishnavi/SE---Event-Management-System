# System Validation Report

**Project:** Event Management System (EMS)
**Team:** 13
**Prepared by:** Dhanyashree K. M.
**SRN:** PES2UG24CS156
**Role:** Test Engineer
**Execution period:** 02-11-2026 to 06-11-2026
**Branch:** `dhanyashree-sprint2-qa`
**Reference:** Software Test Plan (STP) v1.0

## 1. Objective

The objective of this report is to evaluate the Event Management System against the requirements and test cases defined in the Software Test Plan. It records the automated test results, implementation gaps and validations that still require manual or staging-environment execution.

## 2. Validation Environment and Approach

- Backend: Node.js and Express.
- Frontend: React and Vitest.
- Backend testing: Node.js built-in test runner.
- Frontend testing: Vitest, React Testing Library and vitest-axe.
- Validation approach: automated unit/component tests and source-code inspection.

The available automated tests were executed on the QA branch after synchronising it with the latest main branch changes.

## 3. Overall Validation Summary

A total of 32 test cases were reviewed.

| Validation status | Number of cases |
|---|---:|
| Pass (automated) | 23 |
| Manual validation pending | 4 |
| Not implemented / Not found | 5 |
| **Total** | **32** |

The 23 automated-pass cases have corresponding automated checks that passed. Manual validation cases have not been fully completed. Not-implemented cases require development before they can be validated.

## 4. Functional Requirement Validation

| Module | Requirement IDs | Validation result | Observation |
|---|---|---|---|
| Authentication | EMS-F-001 to F-003 | Pass (auto) | Registration, login, password handling and role checks are covered by automated tests. |
| Event management | EMS-F-004 to F-007 | Pass (auto) | Event creation, editing, validation and cancellation are covered. |
| Search and filtering | EMS-F-008 to F-009 | Pass (auto) | Event browsing and filtering are covered by backend and frontend tests. |
| Booking and ticketing | EMS-F-010 to F-012 | Pass (auto) | Booking, ticket generation and cancellation are covered. |
| Payments and refunds | EMS-F-013 to F-015 | Pass (auto) | Payment validation, receipts and refund behaviour are covered by automated tests. |
| Notifications | EMS-F-016 to F-018 | Partial | Booking confirmation and event reminder creation were not found. Event cancellation alerts are implemented and tested. |
| Check-in | EMS-F-019 to F-020 | Pass (auto) | Ticket check-in and related UI behaviour are covered by automated tests. |
| Reporting dashboard | EMS-F-021 to F-023 | Not implemented | Registration reports, CSV/Excel export and analytics dashboard were not found in the inspected application source. |

## 5. Notification Validation

| Test Case | Requirement | Observation | Status |
|---|---|---|---|
| TC-Notify-01 | EMS-F-016: Booking confirmation | No booking-confirmation notification creation logic was found in the inspected backend implementation. | Not implemented |
| TC-Notify-02 | EMS-F-017: Event reminder | No reminder scheduling or delivery logic was found in the inspected backend implementation. | Not implemented |
| TC-Notify-03 | EMS-F-018: Cancellation alert | Event cancellation creates attendee notifications. Automated cancellation tests are available. Email delivery depends on notification webhook configuration. | Pass (auto) |

## 6. Reporting Feature Validation

| Test Case | Requirement | Observation | Status |
|---|---|---|---|
| TC-Dash-01 | EMS-F-021: Registration list | No dedicated organizer registration-report interface or endpoint was found. | Not implemented |
| TC-Dash-02 | EMS-F-022: CSV/Excel export | No CSV or Excel export functionality was found in the inspected frontend source. | Not implemented |
| TC-Dash-03 | EMS-F-023: Analytics | No dedicated analytics dashboard or endpoint was found in the inspected application source. | Not implemented |

## 7. Non-Functional and Security Validation

| Test Case | Requirement | Validation result | Remarks |
|---|---|---|---|
| TC-Perf-01 | EMS-NF-001: Response time | Manual / staging pending | Existing developer performance evidence is documented in `docs/PERFORMANCE.md`. A fresh staging run was not performed for this report. |
| TC-Perf-02 | EMS-NF-002: Concurrent-user load | Manual / staging pending | Existing performance evidence is available, but fresh staging validation remains pending. |
| TC-Sec-01 | EMS-SR-001: TLS 1.2+ | Partial / pending | One automated TLS server test was skipped because OpenSSL was unavailable. A deployed-system TLS scan remains pending. |
| TC-Sec-02 | EMS-SR-002: Password security | Pass (auto) | Automated tests verify password hashing and handling. A separate database audit remains pending. |
| TC-Sec-03 | EMS-SR-003: Payment card data | Pass (auto) | Automated tests cover card-data rejection and handling. A separate database audit remains pending. |
| TC-Sec-04 | EMS-SR-004: Role-based access | Pass (auto) | Automated tests cover authentication and role restrictions. |
| TC-Sec-05 | EMS-SR-005: Account lockout and authentication logging | Pass (auto) | Automated tests cover lockout and authentication audit behaviour. |
| TC-OPS-01 | EMS-NF-004: Two-year log retention | Pass (auto), with limitation | Audit-log retention and archival behaviour are tested. Actual long-term TTL deletion cannot be demonstrated in a short test run. |
| TC-UX-01 | EMS-NF-005: Accessibility | Partial / manual pending | Automated accessibility checks passed. A complete WCAG 2.1 AA screen-reader, keyboard and contrast audit remains pending. |

## 8. Automated Test Evidence

| Component | Total tests | Passed | Failed | Skipped |
|---|---:|---:|---:|---:|
| Backend | 79 | 78 | 0 | 1 |
| Frontend | 52 | 52 | 0 | 0 |
| **Overall** | **131** | **130** | **0** | **1** |

The backend TLS server test was skipped because OpenSSL was unavailable. Refer to `Unit_Test_Report.md` for detailed execution results.

## 9. Defects and Implementation Gaps

The following implementation gaps were identified:

1. Booking confirmation notification creation is not implemented in the inspected application source.
2. Event reminder scheduling and delivery are not implemented in the inspected application source.
3. Organizer registration reporting is not available in the inspected application source.
4. CSV/Excel attendee export is not available in the inspected frontend source.
5. Event analytics dashboard functionality was not found.

These are recorded as implementation gaps, not as failures of existing automated tests.

## 10. Limitations

- Full end-to-end UAT with sample organizers and attendees was not performed.
- A fresh performance test against the staging environment was not performed.
- A deployed-system TLS scan was not performed.
- Database password and card-data audit scripts were not executed against a live test database.
- A complete manual WCAG 2.1 AA audit was not performed.
- Actual long-term log retention cannot be verified within the available test period.
- Third-party email delivery depends on provider/webhook configuration.
- The Test Plan is marked Draft; formal approval and sign-off remain the responsibility of the designated project roles.

## 11. Conclusion

The available automated tests provide positive validation evidence for the implemented authentication, event, search, booking, payment, check-in, cancellation, audit and security-related behaviours.

However, booking confirmation notifications, event reminders and reporting dashboard requirements remain implementation gaps. Performance, deployed TLS, database audits, full accessibility and UAT activities require further validation.

Therefore, the system has passed the executed automated checks, but complete system validation and final acceptance cannot yet be declared.

---

**Prepared by:**  
Dhanyashree K. M.  
PES2UG24CS156
