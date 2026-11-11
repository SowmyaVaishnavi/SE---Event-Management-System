# EMS Frontend: Browse & Filter Events

React (Vite) frontend for the Event Management System, Team 13.
Implements **EMS-F-008** (browse upcoming events) and **EMS-F-009** (filter by category, date, location).

## Run

```bash
npm install
npm run dev          # talks to the backend at http://localhost:5000 (proxy for /api)
npm run dev:mock     # no backend needed: sample events built in (demo only)
npm test             # 19 tests, incl. TC-Search-01 and TC-Search-02
npm run build        # production build in dist/
```

Set `VITE_API_TARGET=http://host:port` to point the dev proxy at another backend.

## Structure

```
src/
  App.jsx                    page: filters + results
  config.js                  category list, debounce
  api/events.js              GET /api/events client (see API_CONTRACT.md)
  api/mockEvents.js          sample data for dev:mock
  hooks/useEvents.js         debounced fetch, loading/error state
  lib/filterEvents.js        live/upcoming + filter rules (pure functions)
  components/                EventFilters, EventList, EventCard
  test/                      unit + component tests
```

## Test cases covered

| Test case      | Requirement | Where                                    |
|----------------|-------------|------------------------------------------|
| TC-Search-01   | EMS-F-008   | `src/test/filterEvents.test.js`, `App.test.jsx` |
| TC-Search-02   | EMS-F-009   | `src/test/filterEvents.test.js`, `App.test.jsx` |

See `API_CONTRACT.md` for the endpoint agreed with the backend and `DEVIATIONS.md` for differences from the SRS/SAD.
