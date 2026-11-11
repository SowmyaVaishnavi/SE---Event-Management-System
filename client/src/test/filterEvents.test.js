import { describe, it, expect } from "vitest";
import { isLiveAndUpcoming, matchesFilters, selectEvents, seatsLeft } from "../lib/filterEvents.js";

const NOW = new Date("2026-10-23T09:00:00");
const ev = (over) => ({
  eventId: "e",
  title: "T",
  category: "Technical",
  venue: "Hall, Bangalore",
  date: "2026-10-30T10:00:00",
  status: "published",
  capacity: 10,
  registeredCount: 3,
  ...over,
});

describe("TC-Search-01: only live and upcoming events are listed", () => {
  it("keeps published future events", () => {
    expect(isLiveAndUpcoming(ev(), NOW)).toBe(true);
  });
  it("drops cancelled, draft and past events", () => {
    expect(isLiveAndUpcoming(ev({ status: "cancelled" }), NOW)).toBe(false);
    expect(isLiveAndUpcoming(ev({ status: "draft" }), NOW)).toBe(false);
    expect(isLiveAndUpcoming(ev({ date: "2026-10-01T10:00:00" }), NOW)).toBe(false);
  });
  it("drops events with a missing or invalid date", () => {
    expect(isLiveAndUpcoming(ev({ date: undefined }), NOW)).toBe(false);
    expect(isLiveAndUpcoming(ev({ date: "not a date" }), NOW)).toBe(false);
  });
  it("sorts soonest first", () => {
    const list = selectEvents(
      [ev({ eventId: "b", date: "2026-11-05T10:00:00" }), ev({ eventId: "a", date: "2026-10-25T10:00:00" })],
      {},
      NOW
    );
    expect(list.map((e) => e.eventId)).toEqual(["a", "b"]);
  });
});

describe("TC-Search-02: filters only show events that match", () => {
  const events = [
    ev({ eventId: "1", category: "Technical", venue: "Hall, Bangalore", date: "2026-10-26T10:00:00" }),
    ev({ eventId: "2", category: "Cultural", venue: "Theatre, Mysuru", date: "2026-11-10T18:00:00" }),
    ev({ eventId: "3", category: "Sports", venue: "Ground, Bangalore", date: "2026-11-20T08:00:00" }),
  ];
  const ids = (filters) => selectEvents(events, filters, NOW).map((e) => e.eventId);

  it("filters by category", () => {
    expect(ids({ category: "Cultural" })).toEqual(["2"]);
  });
  it("filters by location (case-insensitive contains)", () => {
    expect(ids({ location: "bangalore" })).toEqual(["1", "3"]);
  });
  it("filters by date range, inclusive of both end days", () => {
    expect(ids({ from: "2026-10-26", to: "2026-11-10" })).toEqual(["1", "2"]);
    expect(ids({ from: "2026-11-11" })).toEqual(["3"]);
    expect(ids({ to: "2026-10-26" })).toEqual(["1"]);
  });
  it("combines filters with AND", () => {
    expect(ids({ category: "Sports", location: "Bangalore" })).toEqual(["3"]);
    expect(ids({ category: "Sports", location: "Mysuru" })).toEqual([]);
  });
  it("empty filters return everything", () => {
    expect(ids({ category: "", location: "", from: "", to: "" })).toEqual(["1", "2", "3"]);
  });
  it("matchesFilters accepts `location` as an alias of `venue`", () => {
    expect(matchesFilters({ date: "2026-10-26T10:00:00", location: "Hall, Bangalore" }, { location: "hall" })).toBe(true);
  });
});

describe("seatsLeft", () => {
  it("computes remaining seats and never goes below zero", () => {
    expect(seatsLeft(ev({ capacity: 10, registeredCount: 3 }))).toBe(7);
    expect(seatsLeft(ev({ capacity: 10, registeredCount: 12 }))).toBe(0);
  });
  it("returns null when capacity is unknown", () => {
    expect(seatsLeft({})).toBeNull();
  });
});
