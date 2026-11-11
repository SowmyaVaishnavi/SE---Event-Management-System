import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../api/bookings.js", () => ({
  bookEvent: vi.fn(),
  fetchMyTickets: vi.fn(),
  cancelBooking: vi.fn(),
  checkInTicket: vi.fn(),
}));
import { bookEvent, fetchMyTickets, cancelBooking, checkInTicket } from "../api/bookings.js";
import EventCard from "../components/EventCard.jsx";
import MyTickets from "../components/MyTickets.jsx";
import CheckIn from "../components/CheckIn.jsx";

const event = {
  eventId: "e1", title: "Tech Talk", category: "Technical", venue: "Hall",
  date: new Date(Date.now() + 3 * 864e5).toISOString(), price: 0, capacity: 50, registeredCount: 10,
};
const ticket = (over = {}) => ({
  bookingId: "b1", ticketCode: "EMS-ABCD-EFGH-JKLM", status: "confirmed", checkedInAt: null,
  event: { title: "Tech Talk", category: "Technical", date: event.date, venue: "Hall" }, ...over,
});

beforeEach(() => vi.resetAllMocks());

describe("Book a spot (EMS-F-010)", () => {
  it("is hidden for logged-out users and organizers", () => {
    const { rerender } = render(<EventCard event={event} />);
    expect(screen.queryByRole("button", { name: /book a spot/i })).not.toBeInTheDocument();
    rerender(<EventCard event={event} user={{ role: "Organizer" }} />);
    expect(screen.queryByRole("button", { name: /book a spot/i })).not.toBeInTheDocument();
  });

  it("books and shows confirmation", async () => {
    bookEvent.mockResolvedValue({});
    const onBooked = vi.fn();
    render(<EventCard event={event} user={{ role: "Attendee" }} onBooked={onBooked} />);
    await userEvent.click(screen.getByRole("button", { name: /book a spot/i }));
    expect(await screen.findByText(/Booked! Your ticket/i)).toBeInTheDocument();
    expect(bookEvent).toHaveBeenCalledWith("e1");
    expect(onBooked).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Booked" })).toBeDisabled();
  });

  it("shows the server's message when booking fails", async () => {
    bookEvent.mockRejectedValue(new Error("You have already booked this event"));
    render(<EventCard event={event} user={{ role: "Attendee" }} />);
    await userEvent.click(screen.getByRole("button", { name: /book a spot/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already booked");
  });

  it("disables the button when the event is full", () => {
    render(<EventCard event={{ ...event, capacity: 5, registeredCount: 5 }} user={{ role: "Attendee" }} />);
    expect(screen.getByRole("button", { name: "Event full" })).toBeDisabled();
  });
});

describe("My tickets (EMS-F-011, F-012, F-020)", () => {
  it("shows the ticket code and a QR image", async () => {
    fetchMyTickets.mockResolvedValue([ticket()]);
    render(<MyTickets />);
    expect(await screen.findByText("EMS-ABCD-EFGH-JKLM")).toBeInTheDocument();
    expect(await screen.findByAltText(/QR code for your Tech Talk ticket/i)).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    fetchMyTickets.mockResolvedValue([]);
    render(<MyTickets />);
    expect(await screen.findByText(/not booked any events/i)).toBeInTheDocument();
  });

  it("cancels only after confirmation", async () => {
    fetchMyTickets.mockResolvedValueOnce([ticket()]).mockResolvedValueOnce([ticket({ status: "cancelled" })]);
    cancelBooking.mockResolvedValue({ message: "Booking cancelled. Your seat has been released" });
    render(<MyTickets />);
    await userEvent.click(await screen.findByRole("button", { name: /cancel booking/i }));
    expect(cancelBooking).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /yes, cancel booking/i }));
    await waitFor(() => expect(cancelBooking).toHaveBeenCalledWith("b1"));
    expect(await screen.findByText(/seat has been released/i)).toBeInTheDocument();
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(screen.queryByAltText(/QR code/i)).not.toBeInTheDocument();
  });

  it("can keep the booking", async () => {
    fetchMyTickets.mockResolvedValue([ticket()]);
    render(<MyTickets />);
    await userEvent.click(await screen.findByRole("button", { name: /cancel booking/i }));
    await userEvent.click(screen.getByRole("button", { name: /keep it/i }));
    expect(cancelBooking).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /cancel booking/i })).toBeInTheDocument();
  });
});

describe("Check-in (EMS-F-019)", () => {
  it("checks in a valid code and shows the attendee", async () => {
    checkInTicket.mockResolvedValue({ message: "Check-in successful", attendee: { name: "Asha", email: "a@x.com" }, ticket: { event: { title: "Tech Talk" } } });
    render(<CheckIn />);
    await userEvent.type(screen.getByLabelText(/ticket code/i), "EMS-ABCD-EFGH-JKLM");
    await userEvent.click(screen.getByRole("button", { name: /check in/i }));
    expect(await screen.findByText(/Check-in successful/)).toBeInTheDocument();
    expect(screen.getByText(/Asha/)).toBeInTheDocument();
    expect(checkInTicket).toHaveBeenCalledWith("EMS-ABCD-EFGH-JKLM");
  });

  it("shows an error for an invalid or used ticket", async () => {
    checkInTicket.mockRejectedValue(Object.assign(new Error("Already checked in"), { data: {} }));
    render(<CheckIn />);
    await userEvent.type(screen.getByLabelText(/ticket code/i), "EMS-USED");
    await userEvent.click(screen.getByRole("button", { name: /check in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Already checked in");
  });
});
