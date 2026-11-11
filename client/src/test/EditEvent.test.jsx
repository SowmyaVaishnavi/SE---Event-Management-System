// EMS-F-005: an organizer edits an event from "My events" and the change shows right away.
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import MyEvents from "../components/MyEvents.jsx";

const EVENT = {
  eventId: "e1",
  title: "Robotics Expo",
  description: "Demos",
  category: "Technical",
  capacity: 50,
  registeredCount: 4,
  date: "2099-03-10T10:00:00.000Z",
  venue: "Hall A",
  price: 0,
  status: "published",
};

afterEach(() => vi.restoreAllMocks());

test("edits the venue, sends only the change, and shows it right away", async () => {
  const calls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts = {}) => {
    calls.push({ url, opts });
    if (opts.method === "PUT") {
      const changes = JSON.parse(opts.body);
      return new Response(JSON.stringify({ message: "Event updated", event: { ...EVENT, ...changes } }), { status: 200 });
    }
    return new Response(JSON.stringify({ events: [EVENT] }), { status: 200 });
  });

  render(<MyEvents user={{ role: "Organizer" }} />);
  await userEvent.click(await screen.findByRole("button", { name: /edit robotics expo/i }));

  const venue = screen.getByLabelText("Venue");
  expect(venue).toHaveValue("Hall A");
  await userEvent.clear(venue);
  await userEvent.type(venue, "Main Auditorium");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText("Changes saved.")).toBeInTheDocument();
  const put = calls.find((c) => c.opts.method === "PUT");
  expect(put.url).toBe("/api/events/e1");
  expect(JSON.parse(put.opts.body)).toEqual({ venue: "Main Auditorium" });

  await userEvent.click(screen.getByRole("button", { name: "Back to my events" }));
  await waitFor(() => expect(screen.getByText(/Main Auditorium/)).toBeInTheDocument());
});

test("shows the server's error when the edit is rejected", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts = {}) =>
    opts.method === "PUT"
      ? new Response(JSON.stringify({ message: "You can only edit events you created" }), { status: 403 })
      : new Response(JSON.stringify({ events: [EVENT] }), { status: 200 }));

  render(<MyEvents user={{ role: "Organizer" }} />);
  await userEvent.click(await screen.findByRole("button", { name: /edit robotics expo/i }));
  await userEvent.type(screen.getByLabelText("Title"), " 2");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("You can only edit events you created");
});
