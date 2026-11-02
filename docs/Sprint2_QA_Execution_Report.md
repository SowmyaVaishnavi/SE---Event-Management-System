\# Sprint 2 – QA Execution Report



\*\*Project:\*\* Event Management System (EMS)   

\*\*Role:\*\* Test Engineer  

\*\*QA Engineer:\*\* Dhanyashree K. M.  

\*\*SRN:\*\* PES2UG24CS156  

\*\*Sprint:\*\* Sprint 2     

\*\*Branch:\*\* `dhanyashree-sprint2-qa`



\---



\## 1. Objective



The objective of Sprint 2 QA was to execute the available automated tests, inspect the assigned notification, reporting and reliability requirements, identify implementation gaps and document the test results.



\## 2. Automated Test Execution



\### Backend tests



\- Command: `npm --prefix backend test`

\- Total tests: 8

\- Passed: 8

\- Failed: 0



\### Frontend tests



\- Command: `npm --prefix client test`

\- Total tests: 29

\- Passed: 29

\- Failed: 0



\### Overall result



\- Total automated tests: 37

\- Passed: 37

\- Failed: 0



\*\*Result:\*\* All currently available automated backend and frontend tests passed.



\## 3. Evidence



The following screenshots are included in the `evidence` folder:



1\. `Backend\_Test\_Results.png`

2\. `Frontend\_Test\_Results.png`



\## 4. Notification Testing



| Test Case | Requirement | Observation | Status |

|---|---|---|---|

| TC-Notify-01 | EMS-F-016 – Booking confirmation notification | Booking confirmation response exists, but no notification delivery service was found in the inspected application files. | Blocked |

| TC-Notify-02 | EMS-F-017 – Event reminder | No event reminder scheduling or delivery implementation was found in the inspected application files. | Blocked |

| TC-Notify-03 | EMS-F-018 – Cancellation alert | Individual booking cancellation exists, but an organizer event-cancellation alert to all registered attendees was not found in the inspected event routes. | Blocked |



\## 5. Reporting Feature Inspection



| Requirement | Feature | Observation | Status |

|---|---|---|---|

| EMS-F-021 | Registration list | Booking data exists, but no dedicated organizer registration-report interface or endpoint was found in the inspected files. | Not found |

| EMS-F-022 | CSV/Excel export | No CSV or Excel export functionality was found in the inspected frontend source. | Not found |

| EMS-F-023 | Analytics | No dedicated analytics interface or endpoint was found in the inspected application files. | Not found |



\## 6. Reliability and Logging Inspection



\### EMS-NF-002 – 99.5% uptime



No dedicated application uptime-monitoring implementation was found in the inspected files. Actual uptime compliance requires runtime monitoring evidence over the required measurement period.



\*\*Status:\*\* Not verified.



\### EMS-NF-004 – Two-year log retention



The inspected application files did not show a dedicated audit-logging system or log-retention configuration.



\*\*Status:\*\* Not verified.



\## 7. Additional Observations



\- Booking records contain attendee, event, booking status, ticket code, check-in timestamp and cancellation timestamp.

\- Event records contain title, description, category and timestamps.

\- Individual booking cancellation is implemented and covered by backend automated tests.

\- Authentication and role-based access middleware is present.

\- The existing automated test suite does not establish that the notification, reporting or reliability requirements have passed.



\## 8. Summary



A total of 37 automated tests were executed successfully, with 8 backend tests and 29 frontend tests passing.



The assigned notification requirements require further implementation and verification. The reporting features were not found in the inspected application files. Uptime and log-retention compliance could not be established from the available code inspection.



The identified findings should be reviewed with the development team and Product Owner before final requirement closure.



\## 9. Limitations



\- Notification delivery was not verified through an actual email, SMS or other notification channel.

\- Organizer event cancellation and attendee alert delivery were not demonstrated.

\- Registration report generation, CSV/Excel export and analytics were not demonstrated.

\- Long-term uptime and two-year log retention require operational evidence.

\- Findings are limited to the application files inspected during this QA activity.



\---



\*\*Prepared by:\*\*  

Dhanyashree K. M.   

PES2UG24CS156



