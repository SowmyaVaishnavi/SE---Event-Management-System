// EMS-F-006: an organizer cancels an event from "My events"; attendees see the alert under "Alerts".
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import MyEvents from "../components/MyEvents.jsx";
import Alerts from "../components/Alerts.jsx";

const EVENT = { eventId: "e1", title: "Robotics Expo", category: "Technical", capacity: 50, registeredCount: 2, date: "2099-03-10T10:00:00.000Z", venue: "Hall A", price: 0, status: "published" };

afterEach(() => vi.restoreAllMocks());

test("cancel asks to confirm, sends the reason and shows the event as cancelled", async () => {
  const calls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts = {}) => {
    calls.push({ url, opts });
    if (url === "/api/events/e1/cancel") {
      return new Response(JSON.stringify({ status: "cancelled", message: "Event cancelled. 2 attendees were alerted.", event: { ...EVENT, status: "cancelled", cancelReason: "Rain" } }), { status: 200 });
    }
    return new Response(JSON.stringify({ events: [EVENT] }), { status: 200 });
  });

  render(<MyEvents user={{ role: "Organizer" }} />);
  await userEvent.click(await screen.findByRole("button", { name: /cancel event robotics expo/i }));
  expect(screen.getByText(/2 booked attendees will/)).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(/Reason/), "Rain");
  await userEvent.click(screen.getByRole("button", { name: "Yes, cancel event" }));

  expect(await screen.findByText("Event cancelled. 2 attendees were alerted.")).toBeInTheDocument();
  expect(JSON.parse(calls.find((c) => c.url === "/api/events/e1/cancel").opts.body)).toEqual({ reason: "Rain" });
  expect(screen.getByText("cancelled")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /edit robotics expo/i })).not.toBeInTheDocument();
});

test("Alerts lists notifications and marks one as read", async () => {
  const calls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts = {}) => {
    calls.push({ url, opts });
    if (opts.method === "POST") return new Response(JSON.stringify({ message: "Marked as read" }), { status: 200 });
    return new Response(JSON.stringify({ unread: 1, notifications: [{ id: "n1", title: "Cancelled: Robotics Expo", message: "Your ticket is no longer valid.", createdAt: "2099-01-01T10:00:00Z", readAt: null }] }), { status: 200 });
  });
  render(<Alerts />);
  expect(await screen.findByText("Cancelled: Robotics Expo")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /mark as read/i }));
  expect(calls.some((c) => c.url === "/api/notifications/n1/read" && c.opts.method === "POST")).toBe(true);
  expect(screen.queryByRole("button", { name: /mark as read/i })).not.toBeInTheDocument();
});
