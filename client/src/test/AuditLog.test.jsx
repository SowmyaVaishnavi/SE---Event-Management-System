// EMS-SR-005 / EMS-NF-004 (TC-Sec-05, TC-OPS-01): Admin audit log screen and the lockout message at login (fetch mocked).
import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import AuditLog from "../components/AuditLog.jsx";
import Login from "../components/Login.jsx";
import App from "../App.jsx";

const STATUS = { recent: 2, archived: 1, oldest: "2026-01-01T00:00:00.000Z", retentionYears: 2, archiveAfterDays: 90, droppedWrites: 0 };
const rows = [
  { id: "a3", at: "2026-11-02T09:00:00.000Z", category: "auth", action: "account_locked", outcome: "denied", actorLabel: "asha_k", role: "Attendee", ip: "10.0.0.5", target: "", detail: { after: 5 }, archived: false },
  { id: "a2", at: "2026-10-30T09:00:00.000Z", category: "payment", action: "payment_paid", outcome: "success", actorLabel: "", role: "Attendee", ip: "", target: "payment:p1", detail: { amountPaise: 49950 }, archived: false },
  { id: "a1", at: "2026-01-05T09:00:00.000Z", category: "event", action: "event_created", outcome: "success", actorLabel: "", role: "Organizer", ip: "", target: "event:e1", detail: null, archived: true },
];

afterEach(() => vi.restoreAllMocks());

function mockApi(handler) {
  const urls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    urls.push(String(url));
    if (String(url).startsWith("/api/audit-logs/status")) return new Response(JSON.stringify(STATUS), { status: 200 });
    return handler(String(url));
  });
  return urls;
}

test("TC-OPS-01: shows entries, marks archived ones and states the 2-year retention", async () => {
  mockApi(() => new Response(JSON.stringify({ logs: rows, nextBefore: null }), { status: 200 }));
  render(<AuditLog />);

  const list = await screen.findByRole("list", { name: "Audit log entries" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  expect(within(list).getByText("account locked")).toBeInTheDocument();
  expect(within(list).getByText(/asha_k/)).toBeInTheDocument();
  expect(within(list).getByText("archived")).toBeInTheDocument();
  expect(await screen.findByText(/kept for at least 2 years/)).toBeInTheDocument();
  expect(screen.getByText(/1 archived/)).toBeInTheDocument();
});

test("TC-OPS-01: filters by category and result, and can leave out archived entries", async () => {
  const urls = mockApi(() => new Response(JSON.stringify({ logs: [], nextBefore: null }), { status: 200 }));
  render(<AuditLog />);
  expect(await screen.findByText("No entries match.")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Payments" }));
  await userEvent.selectOptions(screen.getByLabelText("Result"), "failure");
  await userEvent.click(screen.getByLabelText(/Include archived entries/));
  await screen.findByText("No entries match.");

  const last = new URL(urls.filter((u) => u.startsWith("/api/audit-logs?")).pop(), "http://x");
  expect(last.searchParams.get("category")).toBe("payment");
  expect(last.searchParams.get("outcome")).toBe("failure");
  expect(last.searchParams.get("archived")).toBe("false");
});

test("TC-OPS-01: 'Load older entries' asks for the next page and appends it", async () => {
  const urls = mockApi((url) => {
    const second = url.includes("before=");
    return new Response(JSON.stringify(second ? { logs: [rows[2]], nextBefore: null } : { logs: [rows[0], rows[1]], nextBefore: rows[1].at }), { status: 200 });
  });
  render(<AuditLog />);
  await screen.findByText("account locked");
  await userEvent.click(screen.getByRole("button", { name: "Load older entries" }));
  expect(await screen.findByText("event created")).toBeInTheDocument();
  expect(screen.getByText("account locked")).toBeInTheDocument(); // first page is still there
  expect(urls.some((u) => u.includes("before=2026-10-30"))).toBe(true);
  expect(screen.queryByRole("button", { name: "Load older entries" })).not.toBeInTheDocument();
});

test("shows the server's error message when the log cannot be loaded", async () => {
  mockApi(() => new Response(JSON.stringify({ message: "You do not have access to this action. It is for Admin accounts only" }), { status: 403 }));
  render(<AuditLog />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/for Admin accounts only/);
});

test("the Audit log tab is offered to Admins only", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ events: [] }), { status: 200 }));
  let view;
  await act(async () => { view = render(<App user={{ name: "Ada", role: "Admin" }} onLogout={() => {}} />); });
  expect(screen.getByRole("button", { name: "Audit log" })).toBeInTheDocument();
  view.unmount();
  await act(async () => { render(<App user={{ name: "Org", role: "Organizer" }} onLogout={() => {}} />); });
  expect(screen.queryByRole("button", { name: "Audit log" })).not.toBeInTheDocument();
});

test("TC-Sec-05: a locked account sees the lock message with the time to wait", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
    JSON.stringify({ message: "Too many failed login attempts. This account is locked for now. Try again in 15 minute(s).", retryAfterSeconds: 900 }),
    { status: 423 }
  ));
  render(<Login onLoggedIn={() => {}} />);
  await userEvent.type(screen.getByLabelText("Username or email"), "asha_k");
  await userEvent.type(screen.getByLabelText("Password"), "wrong-pass");
  await userEvent.click(screen.getByRole("button", { name: "Log in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/locked.*15 minute/);
});
