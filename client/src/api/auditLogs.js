// Audit log API for EMS-SR-005 (auth events) and EMS-NF-004 (event and transaction logs, Admin only).
// See docs/LOG_RETENTION.md.
function authHeaders() {
  const headers = { Accept: "application/json" };
  try {
    const token = localStorage.getItem("ems_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* storage unavailable */
  }
  return headers;
}

async function request(url) {
  let res;
  try {
    res = await fetch(url, { headers: authHeaders() });
  } catch {
    throw new Error("Cannot connect to backend server");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.errors?.join(". ") || data.message || `Request failed (HTTP ${res.status})`);
  return data;
}

// filters: { category, outcome, from, to, archived } (empty values are left out); before = nextBefore of the previous page.
export function fetchAuditLogs(filters = {}, before) {
  const params = new URLSearchParams({ limit: "50" });
  for (const key of ["category", "outcome", "from", "to"]) if (filters[key]) params.set(key, filters[key]);
  if (filters.archived === false) params.set("archived", "false");
  if (before) params.set("before", before);
  return request(`/api/audit-logs?${params}`);
}

export const fetchAuditStatus = () => request("/api/audit-logs/status");
