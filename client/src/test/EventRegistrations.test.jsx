
// EMS-F-021: An organizer views the current confirmed registrations for an event.
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import MyEvents from "../components/MyEvents.jsx";

const EVENT = {
  eventId: "e1",
  title: "Robotics Expo",
  description: "Demos",
  category: "Technical",
  capacity: 50,
  registeredCount: 1,
  date: "2099-03-10T10:00:00.000Z",
  venue: "Hall A",
  price: 0,
  status: "published",
};

afterEach(() => vi.restoreAllMocks());

test("organizer can view the current confirmed registrations for an event", async () => {
  const calls = [];

  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts = {}) => {
    calls.push({ url, opts });

    if (url === "/api/events/e1/registrations") {
      return new Response(
        JSON.stringify({
          eventId: "e1",
          eventTitle: "Robotics Expo",
          totalRegistrations: 1,
          registrations: [
            {
              registrationId: "r1",
              attendeeName: "Test Attendee",
              attendeeEmail: "attendee@test.com",
              bookedAt: "2099-03-01T10:00:00.000Z",
              checkedIn: false,
            },
          ],
        }),
        { status: 200 }
      );
    }

    return new Response(JSON.stringify({ events: [EVENT] }), {
      status: 200,
    });
  });

  render(<MyEvents user={{ role: "Organizer" }} />);

  await userEvent.click(
    await screen.findByRole("button", {
      name: /view registrations.*robotics expo/i,
    })
  );

  expect(await screen.findByText("Test Attendee")).toBeInTheDocument();
  expect(screen.getByText("attendee@test.com")).toBeInTheDocument();
  expect(screen.getByText(/not checked in/i)).toBeInTheDocument();

  expect(
    calls.some((call) => call.url === "/api/events/e1/registrations")
  ).toBe(true);
});
