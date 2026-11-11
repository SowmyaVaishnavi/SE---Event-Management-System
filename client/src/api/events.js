import { MOCK_EVENTS } from "./mockEvents.js";

const USE_MOCK = import.meta.env?.VITE_USE_MOCK === "true";

/**
 * GET /api/events  (see API_CONTRACT.md)
 * Query params (all optional): category, location, from (yyyy-mm-dd), to (yyyy-mm-dd)
 * Response: { events: Event[] }  - a bare array is also accepted.
 */
export async function fetchEvents(filters = {}, { signal } = {}) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    return MOCK_EVENTS;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && String(value).trim() !== "") params.set(key, String(value).trim());
  }
  const qs = params.toString();

  // Browse is public (any attendee can see upcoming events). If a token exists,
  // send it anyway so the backend can personalise results later.
  const headers = { Accept: "application/json" };
  try {
    const token = localStorage.getItem("ems_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* storage unavailable - continue without a token */
  }

  const res = await fetch(`/api/events${qs ? `?${qs}` : ""}`, { headers, signal });
  if (!res.ok) {
    let message = `Could not load events (HTTP ${res.status}).`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      /* non-JSON error body */
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  const body = await res.json();
  return Array.isArray(body) ? body : body.events ?? [];
}
