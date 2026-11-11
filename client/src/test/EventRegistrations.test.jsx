
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


test("organizer can download the attendee list as a CSV file", async () => {
  let downloadedFilename = "";
  let exportedBlob;

  const originalCreate = Object.getOwnPropertyDescriptor(
    URL,
    "createObjectURL"
  );
  const originalRevoke = Object.getOwnPropertyDescriptor(
    URL,
    "revokeObjectURL"
  );

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn((blob) => {
      exportedBlob = blob;
      return "blob:test";
    }),
  });

  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });

  const anchorClick = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function () {
      downloadedFilename = this.download;
    });

  try {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
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

    await userEvent.click(
      await screen.findByRole("button", { name: /download csv/i })
    );

    expect(anchorClick).toHaveBeenCalled();
    expect(downloadedFilename).toBe("Robotics_Expo_attendees.csv");
    expect(exportedBlob).toBeInstanceOf(Blob);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  } finally {
    if (originalCreate) {
      Object.defineProperty(URL, "createObjectURL", originalCreate);
    } else {
      delete URL.createObjectURL;
    }

    if (originalRevoke) {
      Object.defineProperty(URL, "revokeObjectURL", originalRevoke);
    } else {
      delete URL.revokeObjectURL;
    }
  }
});

