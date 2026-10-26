// Pure helpers for EMS-F-008 (browse upcoming events) and EMS-F-009 (filter).
//
// The backend is expected to do this filtering (GET /api/events?...), but the UI
// applies the same rules again so that:
//   - TC-Search-01: only live (published) and upcoming events are ever shown,
//     even if the API returns cancelled, draft or past events by mistake.
//   - TC-Search-02: a filter only ever shows events that match it, even while
//     the backend filtering is not finished yet.

/** Event is live (published, not cancelled) and has not started yet. */
export function isLiveAndUpcoming(event, now = new Date()) {
  if (!event || !event.date) return false;
  const status = String(event.status ?? "published").toLowerCase();
  if (status !== "published") return false;
  const start = new Date(event.date);
  if (Number.isNaN(start.getTime())) return false;
  return start.getTime() >= now.getTime();
}

/** Start of a yyyy-mm-dd day in local time. */
function startOfDay(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** End of a yyyy-mm-dd day in local time. */
function endOfDay(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/**
 * filters: { category: string, location: string, from: "yyyy-mm-dd", to: "yyyy-mm-dd" }
 * Empty values mean "no filter". Category match is exact (case-insensitive),
 * location is a case-insensitive "contains" match on the event venue.
 */
export function matchesFilters(event, filters = {}) {
  const { category = "", location = "", from = "", to = "" } = filters;

  if (category && String(event.category ?? "").toLowerCase() !== category.toLowerCase()) {
    return false;
  }

  if (location) {
    const venue = String(event.venue ?? event.location ?? "").toLowerCase();
    if (!venue.includes(location.trim().toLowerCase())) return false;
  }

  const start = new Date(event.date);
  if (from && start < startOfDay(from)) return false;
  if (to && start > endOfDay(to)) return false;

  return true;
}

/** Live + upcoming + filters, sorted soonest first. */
export function selectEvents(events, filters, now = new Date()) {
  return (events ?? [])
    .filter((e) => isLiveAndUpcoming(e, now) && matchesFilters(e, filters))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/** Seats left, or null when the API did not send capacity information. */
export function seatsLeft(event) {
  if (typeof event.capacity !== "number") return null;
  const taken = typeof event.registeredCount === "number" ? event.registeredCount : 0;
  return Math.max(event.capacity - taken, 0);
}

export function hasActiveFilters(filters) {
  return Object.values(filters).some((v) => String(v).trim() !== "");
}
