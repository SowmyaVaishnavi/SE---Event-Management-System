export async function fetchAnalytics() {
  const headers = { Accept: "application/json" };
  try {
    const token = localStorage.getItem("ems_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {}
  let res;
  try {
    res = await fetch("/api/events/analytics", { headers });
  } catch {
    throw new Error("Cannot connect to backend server");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Could not load analytics (HTTP ${res.status}).`);
  return { totalBookings: 0, totalRevenue: 0, totalAttendance: 0, events: [], ...body };
}