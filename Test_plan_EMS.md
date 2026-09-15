# Software Test Plan (STP)

**Project:** Event Management System (EMS)
**Version:** 1.0
**Team:** 13
**Members:** Dhanyashree K M; Chirag Arun Yadwad; CH Sowmya Vaishnavi; Chinmayee CM
**Date:** 15-09-2026
**Status:** Draft

## 1. Introduction

**Purpose:** This document defines the test plan for the Event Management System (EMS) v1.0. It outlines objectives, scope, strategy, resources, schedule, and responsibilities for testing.

**Scope:** Testing covers EMS features such as authentication, event creation and management, event search, booking and ticketing, payments and refunds, notifications, check-in, and reporting. Hardware devices (attendee phones/tablets used for scanning) and third-party provider internals are excluded.

**References:** EMS SRS v1.0, EMS Software Architecture & Design Specification v1.0, WCAG 2.1 AA, PCI-DSS guidelines.

**Definitions:** EMS (Event Management System), QR (Quick Response code), SRS (Software Requirements Specification), RTM (Requirements Traceability Matrix), RBAC (Role-Based Access Control).

## 2. Test Items

- Login & Account Access module (Auth Service)
- Event creation & management module (Event Service)
- Event search & filtering module
- Booking & ticketing module (Booking Service)
- Payments & refunds module (Payment Service)
- Notifications module (Notification Service)
- Check-in / QR scanning module
- Reports & dashboard module (Reporting Service)

## 3. Features to be Tested

Features mapped to SRS requirement IDs:

- EMS-F-001..003: Sign-up, login, and role-based access
- EMS-F-004..007: Create, edit, cancel, and configure events
- EMS-F-008..009: Browse and filter events
- EMS-F-010..012: Book, ticket, and cancel a registration
- EMS-F-013..015: Payment, receipt, and refund
- EMS-F-016..018: Booking, reminder, and cancellation notifications
- EMS-F-019..020: Ticket scanning and check-in
- EMS-F-021..023: Registrations list, export, and analytics
- EMS-NF-001..005: Performance, reliability, security/compliance, accessibility, scalability
- EMS-SR-001..005: TLS, password hashing, RBAC, signed QR tickets, tokenised payment data

## 4. Features Not to be Tested

- Internal logic of the third-party Payment Gateway (assumed tested by the provider)
- Internal logic of the third-party Notification (email/SMS) provider
- Attendee device hardware (phone/tablet camera used for QR scanning)

## 5. Test Approach / Strategy

**Levels:**

- Unit tests (module-level, e.g. booking-capacity logic, ticket-signing logic)
- Integration tests (Booking Service ↔ Payment Service ↔ Payment Gateway)
- System tests (end-to-end EMS flows: search → book → pay → check-in)
- Acceptance tests (UAT with sample organizers and attendees)

**Types:**

- Functional testing (core features)
- Regression testing
- Performance testing (response time, concurrent-user load)
- Usability & accessibility testing (UI clarity, WCAG 2.1 AA)

**Entry Criteria:** Stable build delivered, test data available, test environment ready.

**Exit Criteria:** 100% of planned test cases executed, 0 critical defects open, all acceptance criteria satisfied.

### 5.1 Security Validation

- Validate password handling (hashing, no plaintext storage or logging)
- TLS 1.2+ verification on all client-server and service-to-service calls
- RBAC checks: confirm each role can only reach its permitted endpoints
- QR ticket forgery/replay testing (signed, single-use validation)
- PCI-DSS-aligned checks on payment flow (no raw card data on EMS servers)
- Fuzzing for input fields (registration forms, event forms, payment forms)

## 6. Test Environment

**Hardware:** Standard desktop/laptop and mobile devices for UI testing; a phone/tablet camera for QR check-in testing.

**Software:** EMS web app v1.0 (React.js front end, Node.js/Express API), test/staging database, payment gateway sandbox, notification provider sandbox.

**Tools:** Selenium / Cypress (UI automation), Postman (API testing), JMeter (performance/load), Jira (defect tracking).

**Test Data:** Dummy attendee/organizer/admin accounts, sample events, and test payment cards from the gateway sandbox.

## 7. Test Schedule

**Milestones:**

- Test case design: 05-Sep-2026
- Environment setup: 07-Sep-2026
- Test execution start: 08-Sep-2026
- Test execution end: 20-Sep-2026
- UAT: 22-Sep-2026 to 25-Sep-2026

## 8. Test Deliverables

- Test Plan (this document)
- Test Cases (manual & automated)
- Test Scripts
- Test Data
- Test Execution Logs
- Defect Reports
- Test Summary Report

## 9. Roles and Responsibilities

| Role | Name | Responsibility |
|---|---|---|
| QA Lead | Chinmayee CM | Prepare plan, coordinate execution |
| Test Engineer | Dhanyashree K M | Design & execute test cases, log defects |
| Developer | Chirag Arun Yadwad | Support defect fixes and triage |
| Product Owner | CH Sowmya Vaishnavi | Approve test results, sign-off readiness |

## 10. Risks and Mitigation

| Risk | Mitigation |
|---|---|
| Delay in stable build delivery | Request early smoke builds from the dev team |
| Test environment downtime | Maintain a backup environment on a cloud VM |
| Dependency on third-party payment/notification providers | Engage providers early and maintain sandbox/mock stubs |

## 11. Assumptions & Dependencies

- The payment gateway and notification provider sandboxes will be stable and available.
- Test data (accounts, sample events, test cards) will be provided before execution.
- The staging environment mirrors production configuration closely enough for valid results.

## 12. Suspension & Resumption Criteria

**Suspend testing if:**

- Environment unavailable for >4 hours
- Build is too unstable (blocks >30% of test cases)

**Resume testing if:**

- Blocking defects are resolved
- Environment is stabilised

## 13. Test Case Management & Traceability

The RTM in the SRS ensures mapping of every requirement to its test case(s).

Representative examples:

- EMS-F-001 (Sign up / choose role) → TC-Auth-01
- EMS-F-010 (Book a spot) → TC-Book-01
- EMS-F-013 (Take payment) → TC-Pay-01
- EMS-F-019 (Scan ticket / check-in) → TC-Checkin-01
- EMS-NF-001 (Response time) → TC-Perf-01
- EMS-SR-004 (Signed single-use QR) → TC-Sec-05

## 14. Test Metrics & Reporting

**Metrics collected:**

- % test cases executed
- % passed / failed
- Defect density
- Defect aging
- Requirement coverage

**Reports:**

- Daily execution status
- Final Test Summary Report

## 15. Approvals

| Role | Name | Signature / Date |
|---|---|---|
| QA Lead | Chinmayee CM | |
| Dev Lead | Chirag Arun Yadwad | |
| Product Owner | CH Sowmya Vaishnavi | |
