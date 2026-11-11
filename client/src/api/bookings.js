// Booking API for EMS-F-010 (book), F-011/F-020 (my tickets), F-012 (cancel), F-019 (check-in).
// All calls need the login token that Root.jsx stores as "ems_token".
function authHeaders() {
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  try {
    const token = localStorage.getItem("ems_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* storage unavailable */
  }
  return headers;
}

async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, { method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error("Cannot connect to backend server");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Request failed (HTTP ${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const bookEvent = (eventId) => request("POST", `/api/events/${encodeURIComponent(eventId)}/register`);
export const fetchMyTickets = async () => (await request("GET", "/api/bookings/me")).tickets ?? [];
export const cancelBooking = (bookingId) => request("POST", `/api/bookings/${encodeURIComponent(bookingId)}/cancel`);
export const checkInTicket = (ticketCode) => request("POST", "/api/checkin/scan", { qrCode: ticketCode });
