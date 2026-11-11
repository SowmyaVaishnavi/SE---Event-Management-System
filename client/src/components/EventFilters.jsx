import React from "react";
import { CATEGORIES } from "../config.js";
import { hasActiveFilters } from "../lib/filterEvents.js";

export const EMPTY_FILTERS = { category: "", location: "", from: "", to: "" };

/** Filter bar for EMS-F-009: category, date range and location. */
export default function EventFilters({ filters, onChange, onClear }) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });

  return (
    <form
      className="filters"
      role="search"
      aria-label="Filter events"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="field">
        <label htmlFor="f-category">Category</label>
        <select id="f-category" value={filters.category} onChange={set("category")}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="f-location">Location</label>
        <input
          id="f-location"
          type="text"
          placeholder="e.g. Bangalore"
          value={filters.location}
          onChange={set("location")}
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="f-from">From date</label>
        <input id="f-from" type="date" value={filters.from} max={filters.to || undefined} onChange={set("from")} />
      </div>

      <div className="field">
        <label htmlFor="f-to">To date</label>
        <input id="f-to" type="date" value={filters.to} min={filters.from || undefined} onChange={set("to")} />
      </div>

      <button
        type="button"
        className="btn btn-secondary"
        onClick={onClear}
        disabled={!hasActiveFilters(filters)}
      >
        Clear filters
      </button>
    </form>
  );
}
