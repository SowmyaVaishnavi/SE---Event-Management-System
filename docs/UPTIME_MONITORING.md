# Uptime monitoring (EMS-NF-002)

Owner: Operations / Test Engineer. Requirement: **at least 99.5% monthly uptime**, excluding scheduled maintenance windows (SRS 5).

## Monitoring endpoint

Use the public, deployed API URL:

`https://<deployed-api-host>/api/health`

The backend provides `GET /api/health` for uptime checks.

| Response | Meaning | Monitoring result |
|----------|---------|-------------------|
| HTTP 200 | API is running and MongoDB is connected (`status: "ok"`, `db: "connected"`) | Available |
| HTTP 503 | API is degraded or MongoDB is disconnected | Unavailable |
| Timeout / connection failure | Health endpoint cannot be reached | Unavailable |

Do not monitor `/api/health/metrics` for uptime. It is an authenticated Admin endpoint for response-time metrics.

## Monitoring procedure

1. Deploy the application and make its health endpoint publicly reachable over HTTPS.
2. Configure an external uptime monitor to request `/api/health` every 1 minute.
3. Treat HTTP 200 with `status: "ok"` and `db: "connected"` as a successful check.
4. Record HTTP 503 responses, timeouts, and connection failures as availability failures.
5. Record incident start time, recovery time, affected service, cause, and corrective action.
6. Record scheduled maintenance separately, including its approved start and end times.
7. Export the monitor history at the end of each calendar month and calculate monthly uptime.

The monitoring interval and alert thresholds are proposed settings and should be approved by the project or operations owner before deployment.

## Monthly uptime calculation

`Uptime (%) = ((Total service minutes - Unplanned downtime minutes) / Total service minutes) * 100`

`Total service minutes = Calendar month minutes - Approved scheduled maintenance minutes`

The monthly result passes EMS-NF-002 when it is **>= 99.5%**.

For a 30-day month with no scheduled maintenance, the maximum permitted unplanned downtime is 216 minutes (3 hours 36 minutes).

## Monthly evidence report template

| Field | Value |
|-------|-------|
| Reporting month | Not recorded |
| Public API URL | Pending deployment |
| Monitoring provider | Pending selection |
| Monitoring interval | Proposed: 1 minute |
| Total calendar minutes | To be recorded |
| Scheduled maintenance minutes | To be recorded |
| Unplanned downtime minutes | To be recorded |
| Calculated uptime | Not measurable yet |
| Target | >= 99.5% |
| Result | Pending deployment and monthly evidence |

Attach the monitor's monthly history/export and incident records as evidence. Do not claim a pass without a complete reporting period and supporting monitoring data.

## Current project status (2026-11-11)

**Not yet measurable.** The course project does not currently have a deployed production or staging API endpoint or a monthly uptime report.

The existing `GET /api/health` endpoint is available for a future external monitor. The implementation of this endpoint alone does not prove 99.5% monthly uptime.

Deviation D-49 remains open until the system is deployed, monitoring evidence is collected for a complete month, and the calculated uptime meets the target.
