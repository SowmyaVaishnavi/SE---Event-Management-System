# Sprint 1 Test Cases - Event Management System



**Project:** Event Management System (EMS)  

**Team:** 13  

**Test Engineer:** Dhanyashree K M  

**SRN:** PES2UG24CS156  

**Sprint:** Sprint 1  

**Test Environment:** React + Vite frontend, running in mock mode  

**Status:** In Progress



## 1. Objective



To verify the Sprint 1 event browsing and filtering features and document the test scenarios, expected results, actual results, and execution status. Authentication and backend API tests will be performed when the relevant implementation is available.



## 2. Test Cases



### TC-Search-01: Display upcoming events



- **Precondition:** The application is running with sample event data.

- **Steps:** Open the application and inspect the event list.

- **Expected Result:** Published upcoming events are displayed; past and cancelled events are excluded.

- **Actual Result:** The sample event list was displayed. Automated test coverage also exists for excluding past and cancelled events.

- **Status:** Partially verified - mock UI inspected; automated test execution to be confirmed.



### TC-Search-02: Filter events by category



- **Precondition:** The event list is visible.

- **Steps:** Select a category such as Technical or Cultural.

- **Expected Result:** Only events matching the selected category are displayed.

- **Actual Result:** Each tested category displayed its matching sample event.

- **Status:** Pass - manual UI check.



### TC-Search-03: Filter events by location



- **Precondition:** The event list is visible.

- **Steps:** Enter `Bangalore` in the location filter.

- **Expected Result:** Only events whose location matches Bangalore are displayed.

- **Actual Result:** Five sample events were displayed.

- **Status:** Pass - manual UI check.



### TC-Search-04: Filter events by date range



- **Precondition:** The event list is visible.

- **Steps:** Set the start date to 3 November 2026 and the end date to 10 November 2026.

- **Expected Result:** Only events within the selected date range, including the boundary dates, are displayed.

- **Actual Result:** Two sample events were displayed.

- **Status:** Pass - manual UI check.



### TC-Search-05: Combine category and location filters



- **Precondition:** The event list is visible.

- **Steps:** Select Cultural and enter Bangalore as the location.

- **Expected Result:** Only events matching both filters are displayed. If no event matches both, an appropriate empty state is displayed.

- **Actual Result:** Zero matching events were displayed.

- **Status:** Pass - manual UI check.



### TC-Search-06: Clear all filters



- **Precondition:** At least one filter is active.

- **Steps:** Apply a filter, then select Clear Filters.

- **Expected Result:** Filters reset and the complete eligible event list is displayed again.

- **Actual Result:** All six sample events were displayed again.

- **Status:** Pass - manual UI check.



### TC-Event-01: Display sold-out event availability



- **Precondition:** A sold-out event is present in the sample data.

- **Steps:** Locate the Hack the Campus 24h Hackathon event.

- **Expected Result:** The event is marked as full and its availability is not misrepresented.

- **Actual Result:** The event displayed â€œEvent fullâ€.

- **Status:** Pass - manual UI check.



### TC-Event-02: Display remaining seats



- **Precondition:** An event with limited remaining capacity is present.

- **Steps:** Locate the React & Node Workshop event.

- **Expected Result:** The displayed remaining-seat count matches the sample data.

- **Actual Result:** The event displayed â€œ2 seats leftâ€.

- **Status:** Pass - manual UI check.



### TC-Event-03: Display event price



- **Precondition:** An event with a free registration price is present.

- **Steps:** Locate the AI & Data Science Symposium event.

- **Expected Result:** The event price is displayed as Free.

- **Actual Result:** The event displayed â€œFreeâ€.

- **Status:** Pass - manual UI check.



### TC-Auth-01: Register with valid details



- **Precondition:** Registration functionality and a suitable test environment are available.

- **Steps:** Submit valid registration details.

- **Expected Result:** The account is created successfully and appropriate confirmation is displayed.

- **Actual Result:** Not tested.

- **Status:** Blocked - registration flow not verified in the current mock UI.



### TC-Auth-02: Reject invalid login credentials



- **Precondition:** Login functionality and a suitable test account are available.

- **Steps:** Submit invalid login credentials.

- **Expected Result:** Access is denied and an appropriate error message is displayed.

- **Actual Result:** Not tested.

- **Status:** Blocked - login flow not verified in the current mock UI.



### TC-Auth-03: Validate required authentication fields



- **Precondition:** The relevant registration or login form is available.

- **Steps:** Submit the form with required fields left blank.

- **Expected Result:** Validation messages are displayed and invalid submission is prevented.

- **Actual Result:** Not tested.

- **Status:** Blocked - authentication forms not verified in the current mock UI.



### TC-Event-04: Validate invalid date range



- **Precondition:** The event list and date filters are available.

- **Steps:** Set the start date later than the end date.

- **Expected Result:** The application should clearly handle the invalid range, preferably by validating the input or explaining that the range is invalid.

- **Actual Result:** Zero events were displayed.

- **Status:** Needs investigation - confirm whether the application should show a validation message.



## 3. Test Execution Summary



- **Total documented test cases:** 13

- **Manual UI checks marked Pass:** 8

- **Partially verified:** 1

- **Blocked / not tested:** 3

- **Needs investigation:** 1



These statuses describe the recorded manual observations. Automated test execution and backend API testing are not yet confirmed by this document.



## 4. Limitations



- Tests were performed against the frontend in mock mode.

- Backend API, database persistence, authentication, and integration behaviour have not been verified here.

- Automated test files exist in `client/src/test/`; their actual execution results should be recorded separately.

- No defect should be reported unless the observed behaviour has been confirmed against the expected requirement.



## 5. Next Steps



1. Run the existing automated tests and record their results.

2. Perform API tests when the backend endpoints are available.

3. Investigate invalid date-range handling.

4. Update the Requirements Traceability Matrix (RTM) with the relevant test IDs and evidence.

5. Commit the completed document on the feature branch and open a pull request.



## Automated Test Execution Results

**Test Framework:** Vitest 2.1.9

**Command Executed:** `npm test`

**Test Files Passed:** 2 of 2

**Total Tests Passed:** 19

**Total Tests Failed:** 0

**Execution Details:**
- `src/test/App.test.jsx` - 7 tests passed.
- `src/test/filterEvents.test.js` - 12 tests passed.

**Overall Result:** PASS

**Note:** These results cover automated frontend tests. Backend API, database, and authentication testing have not been verified as part of this execution.