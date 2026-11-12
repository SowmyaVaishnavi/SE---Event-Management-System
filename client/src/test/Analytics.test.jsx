import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import Analytics from "../components/Analytics.jsx";

afterEach(() => vi.restoreAllMocks());

const DATA = {
  totalBookings: 5, totalAttendance: 3, totalRevenue: 2000,
  events: [
    { eventId: "e1", title: "Tech Talk", status: "published", totalBookings: 3, totalAttendance: 2, totalRevenue: 1500 },
    { eventId: "e2", title: "Workshop", status: "published", totalBookings: 2, totalAttendance: 1, totalRevenue: 500 },
  ],
};
const respond = (body, status = 200) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

test("TC-Dash-03: shows totals and one row per event", async () => {
  const spy = respond(DATA);
  render(<Analytics />);
  const totals = await screen.findByRole("list", { name: "Totals" });
  expect(within(totals).getByText("5")).toBeInTheDocument();
  expect(within(totals).getByText("3")).toBeInTheDocument();
  expect(within(totals).getByText("₹2,000.00")).toBeInTheDocument();
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("row")).toHaveLength(3);
  expect(within(within(table).getByRole("row", { name: /Tech Talk/ })).getByText("₹1,500.00")).toBeInTheDocument();
  expect(spy.mock.calls[0][0]).toBe("/api/events/analytics");
});

test("TC-Dash-03: empty state when there are no events", async () => {
  respond({ totalBookings: 0, totalRevenue: 0, totalAttendance: 0, events: [] });
  render(<Analytics />);
  expect(await screen.findByText(/nothing to show/)).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

test("TC-Dash-03: shows the server message on failure and retries", async () => {
  const spy = respond({ message: "You do not have access to this action." }, 403);
  render(<Analytics />);
  expect(await screen.findByRole("alert")).toHaveTextContent("You do not have access");
  spy.mockResolvedValue(new Response(JSON.stringify(DATA), { status: 200 }));
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("table")).toBeInTheDocument();
});