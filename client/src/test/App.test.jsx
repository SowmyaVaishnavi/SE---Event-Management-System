import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../api/events.js", () => ({ fetchEvents: vi.fn() }));
import { fetchEvents } from "../api/events.js";
import App from "../App.jsx";

const future = (days) => new Date(Date.now() + days * 86400000).toISOString();
const base = { capacity: 100, registeredCount: 10, price: 0, status: "published" };

const EVENTS = [
  { ...base, eventId: "1", title: "Tech Talk", category: "Technical", venue: "Hall, Bangalore", date: future(3) },
  { ...base, eventId: "2", title: "Music Night", category: "Cultural", venue: "Theatre, Mysuru", date: future(6) },
  { ...base, eventId: "3", title: "Old Meetup", category: "Social", venue: "Hall, Bangalore", date: future(-4) },
  { ...base, eventId: "4", title: "Called Off", category: "Technical", venue: "Hall, Bangalore", date: future(4), status: "cancelled" },
  { ...base, eventId: "5", title: "Sold Out Fest", category: "Sports", venue: "Ground, Bangalore", date: future(8), capacity: 5, registeredCount: 5 },
];

beforeEach(() => {
  fetchEvents.mockReset();
  fetchEvents.mockResolvedValue(EVENTS);
});

describe("Browse page (EMS-F-008)", () => {
  it("shows only live, upcoming events", async () => {
    render(<App />);
    expect(await screen.findByText("Tech Talk")).toBeInTheDocument();
    expect(screen.getByText("Music Night")).toBeInTheDocument();
    expect(screen.queryByText("Old Meetup")).not.toBeInTheDocument();
    expect(screen.queryByText("Called Off")).not.toBeInTheDocument();
    expect(await screen.findByText("3 events found")).toBeInTheDocument();
  });

  it("marks a full event", async () => {
    render(<App />);
    expect(await screen.findByText("Sold Out Fest")).toBeInTheDocument();
    expect(screen.getByText("Event full")).toBeInTheDocument();
  });

  it("shows an empty state when nothing is upcoming", async () => {
    fetchEvents.mockResolvedValue([]);
    render(<App />);
    expect(await screen.findByText(/no upcoming events right now/i)).toBeInTheDocument();
  });

  it("shows an error and lets the user retry", async () => {
    fetchEvents.mockRejectedValueOnce(new Error("Server unavailable"));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Server unavailable");

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Tech Talk")).toBeInTheDocument();
  });
});

describe("Filter events (EMS-F-009)", () => {
  it("filters by category and only shows matches", async () => {
    render(<App />);
    await screen.findByText("Tech Talk");

    await userEvent.selectOptions(screen.getByLabelText("Category"), "Cultural");

    await waitFor(() => expect(screen.queryByText("Tech Talk")).not.toBeInTheDocument());
    expect(screen.getByText("Music Night")).toBeInTheDocument();
    expect(fetchEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: "Cultural" }),
      expect.anything()
    );
  });

  it("filters by location", async () => {
    render(<App />);
    await screen.findByText("Tech Talk");

    await userEvent.type(screen.getByLabelText("Location"), "mysuru");

    await waitFor(() => expect(screen.queryByText("Tech Talk")).not.toBeInTheDocument());
    expect(screen.getByText("Music Night")).toBeInTheDocument();
  });

  it("shows a no-match message and clears filters", async () => {
    render(<App />);
    await screen.findByText("Tech Talk");

    await userEvent.type(screen.getByLabelText("Location"), "Delhi");
    expect(await screen.findByText(/no upcoming events match your filters/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(await screen.findByText("Tech Talk")).toBeInTheDocument();
    expect(screen.getByLabelText("Location")).toHaveValue("");
  });
});
