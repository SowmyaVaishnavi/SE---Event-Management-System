# Software Requirements Specification (SRS)

**Project:** Event Management System  
**Version:** 1.0  
**Authors:** Dhanyashree K M, Chirag Arun Yadwad, CH Sowmya Vaishnavi, Chinmayee CM   
**Date:** 05-09-2026  
**Status:** Draft

## Revision history

| Version | Date | Author | Change summary | Approval |
|---|---|---|---|---|
| 1.0 | 05-09-2026 | Team 13 | Initial SRS for Event Management System | |

## Approvals

| Role | Name | Signature / Email | Date |
|---|---|---|---|
| Course Coordinator | | | |

## Table of Contents

1. Introduction
2. Overall description
3. External interfaces
4. System features (detailed)
5. Non-functional requirements (detailed)
6. Quality attributes & Acceptance tests
7. UML Use-Case Diagram
8. Requirements Traceability Matrix (RTM)

---

# 1. Introduction

## 1.1 Purpose

- This document presents the Software Requirements Specification (SRS) for the Event Management System (EMS).
- The purpose of this system is to simplify the process of organizing and managing events and event registrations.
- The system allows authorized users to create and manage events.
- Participants can view available events and register for them.
- This document defines the functional requirements, non-functional requirements, interfaces, and other specifications of the system.

## 1.2 Scope

- The Event Management System is a web-based application designed to manage and organize events efficiently.
- The system allows administrators and event organizers to create, update, delete, and manage events.
- Users or participants can view available events, check event details, and register for events.
- The system includes user authentication, event management, event registration, participant management, and viewing registration details.
- The system does not include physical event arrangements such as venue decoration, transportation, catering, or payment processing unless added in future versions.

## 1.3 Audience

Developers, QA Engineers, System Administrators, Event Organizers, Project Team Members, and Assessment Evaluators.

## 1.4 Definitions

**List of acronyms:** EMS, Admin, UI, API, CRUD, DBMS, JWT.

---

# 2. Overall description

## 2.1 Product Perspective

- The Event Management System is a web-based application designed to simplify the process of organizing and managing events.
- It provides a centralized platform where administrators and event organizers can create and manage events.
- Participants can view event details and register for events.
- The system consists of a user-friendly interface, backend services for managing events and registrations, and a database for storing user, event, and registration information.

## 2.2 Major Product Functions (Detailed)

- User registration and authentication
- Create and manage events
- View available events and event details
- Register for events
- Cancel event registration
- Update and delete events
- Manage participants and registrations
- Search and filter events
- Administrative management of users and events
- View registration details and event information

## 2.3 User Roles and Characteristics (Expanded)

- **Administrator:** Manages users, events, registrations, and overall system operations.
- **Event Organizer:** Creates, updates, and manages events and views participant registrations.
- **Participant:** Views available events, checks event details, and registers for events.

## 2.4 Operating Environment

Web-based application running on modern web browsers with internet connectivity. The frontend will be developed using React.js, the backend using Node.js and Express.js, and the database will be MongoDB.

## 2.5 Constraints

- The system requires a stable internet connection.
- Users must register and authenticate to access certain features.
- The system must support modern web browsers.
- Event registration is limited based on the maximum participant capacity.
- The system will be developed using the specified technology stack and available development resources.

---

# 3. External Interfaces

## 3.1 User Interfaces

- People use EMS through a website that also works on phones and tablets — no app install needed.
- Attendees can search for events, book a spot, see their ticket (with QR code), and get notifications.
- Organizers and Admins can create events, manage bookings, check in attendees, and view reports.
- Screens use clear fonts, good colour contrast, and work with screen readers, so they are easy for everyone to use.

## 3.2 Hardware Interfaces

- A phone or tablet camera is used to scan the QR ticket when an attendee arrives at the event.
- No special hardware is needed — any phone, tablet, or computer with internet access works fine.
- Organizers can print tickets or receipts on a normal printer if they choose to.

## 3.3 Software Interfaces

- **Payment Gateway** — an outside service that takes payments, prints receipts, and handles refunds.
- **Notification Service** — an outside service that sends emails or texts for confirmations, reminders, and cancellations.
- **Core Database/API** — stores all event, booking, and user information, and powers the dashboard and reports.
- **Auth Service** — checks who is logging in and what they are allowed to do (Attendee, Organizer, or Admin).

## 3.4 Communications

- All information sent between a user's device and the EMS is encrypted, so it stays private and safe.
- When a payment is made, the Payment Gateway sends a message back saying if it worked or failed.
- If a notification (email/text) fails to send, the system automatically tries again.

---

# 4. System Features (Detailed)

## 4.1 Login & Account Access

**Description:** Lets people sign up, log in, and make sure everyone only sees what they're allowed to see. IDs: EMS-F-001..EMS-F-003.

| Req ID | Requirement | Type | Priority | Source/Stakeholder | Acceptance criteria / Test case ref | Comments / Dependencies |
|---|---|---|---|---|---|---|
| EMS-F-001 | A new user can sign up and choose to be an Attendee or an Organizer. | Functional | High | All users | Signing up creates an account, and the person can log in right after. Test: TC-Auth-01 | “Register Account / Login” |
| EMS-F-002 | A user can log in using their username and password to reach their account. | Functional | High | All users | Correct login lets a user in; wrong login shows an error. Test: TC-Auth-02 | “Login / Authenticate” |
| EMS-F-003 | The system only lets each type of user (Attendee, Organizer, Admin) use the features meant for them. | Functional | High | All users | Trying to use a feature outside your role shows an error message. Test: TC-Auth-03 | Admin builds on Organizer role |

## 4.2 Creating & Managing Events

**Description:** Lets organizers set up events and change or cancel them later. IDs: EMS-F-004..EMS-F-007.

| Req ID | Requirement | Type | Priority | Source/Stakeholder | Acceptance criteria / Test case ref | Comments / Dependencies |
|---|---|---|---|---|---|---|
| EMS-F-004 | An Organizer can create a new event with a title, description, and category. | Functional | High | Organizer | A new event shows up in the event list after creation. Test: TC-Event-01 | “Create Event” |
| EMS-F-005 | An Organizer can edit the details of an event they created. | Functional | High | Organizer | Changes are saved and shown right away. Test: TC-Event-02 | “Edit Event” |
| EMS-F-006 | An Organizer can cancel an event, and all attendees get a cancellation alert. | Functional | High | Organizer | Cancelling marks the event as cancelled and sends alerts to everyone registered. Test: TC-Event-03 | “Cancel Event”, sends alerts |
| EMS-F-007 | An Organizer can set the event's capacity, date, venue, and price. | Functional | High | Organizer | The event can't be published without these details filled in correctly. Test: TC-Event-04 | “Set Event Details” |

## 4.3 Finding Events

**Description:** Lets attendees browse and narrow down events they might want to attend. IDs: EMS-F-008..EMS-F-009.

| Req ID | Requirement | Type | Priority | Source/Stakeholder | Acceptance criteria / Test case ref | Comments / Dependencies |
|---|---|---|---|---|---|---|
| EMS-F-008 | An Attendee can browse a list of upcoming events. | Functional | High | Attendee | Only events that are live and upcoming appear in the list. Test: TC-Search-01 | “Search & Browse Events” |
| EMS-F-009 | An Attendee can filter events by category, date, or location. | Functional | Medium | Attendee | Using a filter only shows events that match it. Test: TC-Search-02 | “Filter Events” |

## 4.4 Booking a Spot

**Description:** Lets attendees reserve a place at an event and manage their own booking. IDs: EMS-F-010..EMS-F-012.

| Req ID | Requirement | Type | Priority | Source/Stakeholder | Acceptance criteria / Test case ref | Comments / Dependencies |
|---|---|---|---|---|---|---|
| EMS-F-010 | An Attendee can book a spot at an event if space is available. | Functional | High | Attendee | Booking works only while spots remain; it's blocked once the event is full. Test: TC-Book-01 | “Register for Event” |
| EMS-F-011 | A ticket with a QR code is created automatically after a booking is confirmed. | Functional | High | Attendee | Every confirmed booking has exactly one ticket. Test: TC-Book-02 | “Generate Ticket” |
| EMS-F-012 | An Attendee can cancel their own booking. | Functional | Medium | Attendee | Cancelling frees up the spot and the old ticket stops working. Test: TC-Book-03 | “Cancel My Registration” |

## 4.5 Payments

**Description:** Handles paying for events, getting a receipt, and refunds. IDs: EMS-F-013..EMS-F-015.

| Req ID | Requirement | Type | Priority | Source/Stakeholder | Acceptance criteria / Test case ref | Comments / Dependencies |
|---|---|---|---|---|---|---|
| EMS-F-013 | The system takes payment for paid events before confirming a booking. | Functional | High | Attendee | A paid booking is only confirmed once the payment succeeds. Test: TC-Pay-01 | “Make Payment” |
| EMS-F-014 | A receipt is created and shown after a successful payment. | Functional | Medium | Attendee | The receipt shows the right amount, event, and date right after paying. Test: TC-Pay-02 | “View / Download Receipt” |
| EMS-F-015 | An Admin can issue a refund for a cancelled or eligible paid booking. | Functional | High | Admin | Only an Admin can start a refund, and the attendee is told once it's done. Test: TC-Pay-03 | “Process Refund (Admin)” |

## 4.6 Notifications

**Description:** Keeps attendees informed by email or text. IDs: EMS-F-016..EMS-F-018.

| Req ID | Requirement | Type | Priority | Source/Stakeholder | Acceptance criteria / Test case ref | Comments / Dependencies |
|---|---|---|---|---|---|---|
| EMS-F-016 | A confirmation message is sent right after a booking. | Functional | High | Attendee | The message is sent within a minute of booking. Test: TC-Notify-01 | “Receive/Send Notifications” |
| EMS-F-017 | A reminder message is sent before the event starts. | Functional | Medium | Attendee | The reminder goes out a set time before the event (e.g., 24 hours). Test: TC-Notify-02 | “Send Notifications” |
| EMS-F-018 | A cancellation alert is sent to everyone booked if an event is cancelled. | Functional | High | Attendee | Everyone who booked gets the alert. Test: TC-Notify-03 | “Send Notifications” |

## 4.7 Checking In at the Event

**Description:** Confirms attendees have arrived by scanning their ticket. IDs: EMS-F-019..EMS-F-020.

| Req ID | Requirement | Type | Priority | Source/Stakeholder | Acceptance criteria / Test case ref | Comments / Dependencies |
|---|---|---|---|---|---|---|
| EMS-F-019 | An Organizer or Admin can scan a ticket to check an attendee in. | Functional | High | Organizer / Admin | A valid ticket checks the attendee in; a used or fake ticket is rejected. Test: TC-Checkin-01 | “Scan Ticket / Check-in” |
| EMS-F-020 | An Attendee can show their ticket/QR code at the entrance to be scanned. | Functional | Medium | Attendee | The ticket stays visible and scannable up to and during the event. Test: TC-Checkin-02 | “Present Ticket at Check-in” |

## 4.8 Reports & Dashboard

**Description:** Gives organizers a clear view of how their event is doing. IDs: EMS-F-021..EMS-F-023.

| Req ID | Requirement | Type | Priority | Source/Stakeholder | Acceptance criteria / Test case ref | Comments / Dependencies |
|---|---|---|---|---|---|---|
| EMS-F-021 | An Organizer can see the list of people registered for their event. | Functional | High | Organizer | The list always matches the current bookings. Test: TC-Dash-01 | “View Registrations” |
| EMS-F-022 | An Organizer can download the attendee list as a CSV or Excel file. | Functional | Medium | Organizer | The downloaded file matches what's shown on screen. Test: TC-Dash-02 | “Export Attendee List” |
| EMS-F-023 | The system shows simple stats for an event: bookings, money made, and attendance. | Functional | Medium | Organizer / Admin | The numbers shown match the actual bookings and payments. Test: TC-Dash-03 | “View Event Analytics & Reports” |

---

# 5. Non-functional requirements (detailed)

| Req ID | Requirement | Category | Priority | Acceptance criteria / Measurement |
|---|---|---|---|---|
| EMS-NF-001 | Overall page load and API response time shall be ≤ 3 seconds for 90% of requests under normal load. | Performance | High | 90th percentile ≤ 3s in a production-like test. Test: TC-Perf-01 |
| EMS-NF-002 | System shall provide 99.5% uptime monthly, excluding scheduled maintenance windows. | Reliability | High | Uptime reports show ≥99.5% per month. Test: Ops reports. |
| EMS-NF-003 | All sensitive user and payment data must be transmitted over HTTPS; passwords must never be stored in plaintext. | Security/Compliance | High | Security audit checklist pass. Test: TC-Sec-01 |
| EMS-NF-004 | System shall retain event and transaction logs for a minimum of 2 years for audit and dispute-resolution purposes. | Audit/Data Retention | High | Automated archival and retrieval verified. Test: TC-OPS-01 |
| EMS-NF-005 | System shall support accessibility features (screen reader labels, high-contrast mode) conforming to WCAG 2.1 AA where applicable. | Usability/Accessibility | Medium | Accessibility audit pass. Test: TC-UX-01 |

## 5.1 Security

### 5.1.1 Security Objectives

- Protect user credentials and payment information from unauthorized access or disclosure.
- Ensure only authenticated and authorized users (organizers and administrators) can create, modify, or cancel events.

### 5.1.2 Security Requirements

| Req ID | Requirement (shall...) | Type | Priority | Acceptance criteria / Test case ref |
|---|---|---|---|---|
| EMS-SR-001 | TLS 1.2+ mandatory for all network connections. | Security | High | Traffic scan confirms no unencrypted connections. Test: TC-Sec-01 |
| EMS-SR-002 | The system shall hash all user passwords using bcrypt (or an equivalent algorithm) before storage. | Security | High | No plaintext passwords found in DB audit. Test: TC-Sec-02 |
| EMS-SR-003 | The system shall never store raw payment card data; card details shall be handled solely by the PCI-DSS compliant payment gateway. | Security | High | Database scan finds no stored card numbers. Test: TC-Sec-03 |
| EMS-SR-004 | The system shall implement role-based access control (RBAC) to restrict organizer and admin functions from attendee accounts. | Security | High | Attendee accounts cannot access admin/organizer endpoints. Test: TC-Sec-04 |
| EMS-SR-005 | The system shall enforce account lockout after repeated failed login attempts and log all authentication events for audit purposes. | Security | Medium | Lockout triggers after threshold; auth events appear in logs. Test: TC-Sec-05 |

---

# 6. Quality attributes & Acceptance tests

- **Exit criteria for acceptance:** All high-priority functional requirements implemented and verified, no critical NFR failures, and RTM shows all test cases passed.
- **Acceptance test suites:** Authentication, Event Management, Registration & Payment, Notifications, Performance, Security, and Accessibility tests.

---

# 7. System models and diagrams

## 7.1 UML Use-Case Diagram

### 7.1.1 Diagram 1 — Attendee (Discovery, Registration & Payment)

**Primary actor:** Attendee.  
**Secondary actor:** Payment Gateway (external system).

This diagram covers account access, event discovery/search, booking, ticket generation, payment, notifications, cancellation, and check-in from the attendee's point of view.

- **Association** — Attendee directly initiates: Register Account/Login, Search & Browse Events, Register for Event, Cancel My Registration, Receive Notifications, View/Download Receipt, Present Ticket at Check-in.
- **`<<extend>>`** — Filter Events extends Search & Browse Events (optional refinement).
- **`<<include>>`** — Register for Event always includes Generate Ticket, and includes Make Payment when the event is paid.
- **Payment Gateway (external actor)** participates in the Make Payment use case.

### 7.1.2 Diagram 2 — Organizer / Admin (Event Management, Dashboard & Notifications)

**Primary actors:** Organizer and Admin (Admin is a specialised Organizer — shown with a generalization arrow — and additionally has refund authority).  
**Secondary actor:** Notification Service (external system).

This diagram covers event creation/management, registration/attendance oversight, reporting, notifications, and refunds from the organizing side.

- **Association** — Organizer directly initiates: Login/Authenticate, Create Event, Edit Event, Cancel Event, View Registrations, Export Attendee List, View Event Analytics & Reports, Scan Ticket/Check-in Attendee.
- **Generalization** — Admin inherits all Organizer use cases and additionally performs Process Refund.
- **`<<include>>`** — Create Event and Edit Event both include Set Event Details (capacity/date/venue/price); Cancel Event includes Send Notifications (cancellation alert).
- **Notification Service (external actor)** participates in the Send Notifications use case.

> **Diagram images:** The original PDF contains UML diagrams on pages 8–9. Markdown cannot reproduce the original Word/PDF drawing objects exactly, so the textual UML relationships above are preserved here.

---

# 8. Requirements Traceability Matrix (RTM)

| Req ID | Requirement (short) | Section Ref / Design Spec | Module | Test Case(s) | Status (N/P/A) | Comments |
|---|---|---|---|---|---|---|
| EMS-F-001 | Register a new account (Attendee or Organizer role) | 4.1 / DS-Auth-01 | AuthModule | TC-Auth-01 | N | Covers UC “Register Account / Login” — Diagram 1 |
| EMS-F-002 | Authenticate user login (Attendee / Organizer / Admin) | 4.1 / DS-Auth-02 | AuthModule | TC-Auth-02 | N | Covers UC “Login / Authenticate” — Diagram 1 & 2 |
| EMS-F-003 | Enforce role-based access control across roles | 4.1 / DS-Auth-03 | AuthModule | TC-Auth-03 | N | Supports Admin generalization from Organizer — Diagram 2 |
| EMS-F-004 | Create a new event (title, description, category) | 4.2 / DS-Event-01 | EventModule | TC-Event-01 | N | Covers UC “Create Event” — Diagram 2 |
| EMS-F-005 | Edit an existing event's details | 4.2 / DS-Event-02 | EventModule | TC-Event-02 | N | Covers UC “Edit Event” — Diagram 2 |
| EMS-F-006 | Cancel a scheduled event | 4.2 / DS-Event-03 | EventModule | TC-Event-03 | N | Covers UC “Cancel Event”; triggers `<<include>>` Send Notifications — Diagram 2 |
| EMS-F-007 | Set / update event capacity, date, venue and price | 4.2 / DS-Event-04 | EventModule | TC-Event-04 | N | Covers UC “Set Event Details”, `<<include>>` of Create/Edit Event — Diagram 2 |
| EMS-F-008 | Browse the list of published / upcoming events | 4.3 / DS-Search-01 | SearchModule | TC-Search-01 | N | Covers UC “Search & Browse Events” — Diagram 1 |
| EMS-F-009 | Filter events by category, date and location | 4.3 / DS-Search-02 | SearchModule | TC-Search-02 | N | Covers UC “Filter Events”, `<<extend>>` of Search & Browse — Diagram 1 |
| EMS-F-010 | Register / book a spot for a selected event | 4.4 / DS-Book-01 | BookingModule | TC-Book-01 | N | Covers UC “Register for Event” — Diagram 1 |
| EMS-F-011 | Generate an e-ticket with QR code on successful booking | 4.4 / DS-Book-02 | BookingModule | TC-Book-02 | N | Covers UC “Generate Ticket”, `<<include>>` of Register for Event — Diagram 1 |
| EMS-F-012 | Allow an attendee to cancel their own registration | 4.4 / DS-Book-03 | BookingModule | TC-Book-03 | N | Covers UC “Cancel My Registration” — Diagram 1 |
| EMS-F-013 | Process checkout / payment for paid events | 4.5 / DS-Pay-01 | PaymentModule | TC-Pay-01 | N | Covers UC “Make Payment”, `<<include>>` of Register for Event (if paid) — Diagram 1 |
| EMS-F-014 | Generate and display a payment receipt | 4.5 / DS-Pay-02 | PaymentModule | TC-Pay-02 | N | Covers UC “View / Download Receipt” — Diagram 1 |
| EMS-F-015 | Process a refund for a cancelled / paid registration | 4.5 / DS-Pay-03 | PaymentModule | TC-Pay-03 | N | Covers UC “Process Refund (Admin)” — Diagram 2 |
| EMS-F-016 | Send registration confirmation notification | 4.6 / DS-Notify-01 | NotificationModule | TC-Notify-01 | N | Covers UC “Receive Notifications” / “Send Notifications” — Diagram 1 & 2 |
| EMS-F-017 | Send an event reminder notification before the event date | 4.6 / DS-Notify-02 | NotificationModule | TC-Notify-02 | N | Covers UC “Send Notifications” — Diagram 2 |
| EMS-F-018 | Send a cancellation alert to all registered attendees | 4.6 / DS-Notify-03 | NotificationModule | TC-Notify-03 | N | Covers UC “Send Notifications”, `<<include>>` of Cancel Event — Diagram 2 |
| EMS-F-019 | Scan an attendee's QR ticket to check them in at the venue | 4.7 / DS-Checkin-01 | CheckInModule | TC-Checkin-01 | N | Covers UC “Scan Ticket / Check-in Attendee” — Diagram 2 |
| EMS-F-020 | Present the ticket / QR code at the venue entry | 4.7 / DS-Checkin-02 | CheckInModule | TC-Checkin-02 | N | Covers UC “Present Ticket at Check-in” — Diagram 1 |
| EMS-F-021 | View the list of registrations for a given event | 4.8 / DS-Dash-01 | DashboardModule | TC-Dash-01 | N | Covers UC “View Registrations” — Diagram 2 |
| EMS-F-022 | Export the attendee list (CSV / Excel) | 4.8 / DS-Dash-02 | DashboardModule | TC-Dash-02 | N | Covers UC “Export Attendee List” — Diagram 2 |
| EMS-F-023 | Display basic analytics (registrations, revenue, attendance) | 4.8 / DS-Dash-03 | DashboardModule / CoreAPI | TC-Dash-03 | N | Covers UC “View Event Analytics & Reports” — Diagram 2 |
| EMS-NF-001 | Page / API response time target (<2s for 95% of requests) | 5.1 / DS-Perf-01 | WebUI / CoreAPI | TC-Perf-01 | N | performance requirement |
| EMS-NF-002 | Support a minimum of 500 concurrent users at peak load | 5.2 / DS-Perf-02 | CoreAPI | TC-Perf-02 | N | scalability requirement |
| EMS-NF-003 | Encrypt sensitive data (passwords, payment info) in transit and at rest | 5.3 / DS-Sec-01 | AuthModule / PaymentModule | TC-Sec-01 | N | security requirement |
| EMS-NF-004 | System shall retain event and transaction logs for a minimum of 2 years for audit and dispute-resolution purposes. | 5 / DS-OPS-01 | CoreAPI / Ops | TC-OPS-01 | N | audit/data retention requirement |
| EMS-NF-005 | System shall support accessibility features (screen reader labels, high-contrast mode) conforming to WCAG 2.1 AA where applicable. | 5 / DS-UX-01 | WebUI | TC-UX-01 | N | usability/accessibility requirement |

## Security requirements in RTM

| Req ID | Requirement (short) | Section Ref / Design Spec | Module | Test Case(s) | Status | Comments |
|---|---|---|---|---|---|---|
| EMS-SR-001 | TLS 1.2+ mandatory for all network connections. | 5.1.2 / DS-Sec-01 | AuthModule / PaymentModule | TC-Sec-01 | N | security requirement |
| EMS-SR-002 | The system shall hash all user passwords using bcrypt (or an equivalent algorithm) before storage. | 5.1.2 / DS-Sec-02 | AuthModule | TC-Sec-02 | N | security requirement |
| EMS-SR-003 | The system shall never store raw payment card data; card details shall be handled solely by the PCI-DSS compliant payment gateway. | 5.1.2 / DS-Sec-03 | PaymentModule | TC-Sec-03 | N | security requirement |
| EMS-SR-004 | The system shall implement role-based access control (RBAC) to restrict organizer and admin functions from attendee accounts. | 5.1.2 / DS-Sec-04 | AuthModule | TC-Sec-04 | N | security requirement |
| EMS-SR-005 | The system shall enforce account lockout after repeated failed login attempts and log all authentication events for audit purposes. | 5.1.2 / DS-Sec-05 | AuthModule | TC-Sec-05 | N | security requirement |

---

**Source:** Software Requirements Specification (SRS), Event Management System, Version 1.0, dated 05-09-2026.
