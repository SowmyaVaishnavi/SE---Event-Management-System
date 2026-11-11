import React, { useState } from "react";
import { CATEGORIES } from "../config.js";

// EMS-F-004 / F-007: create an event (title, description, category + capacity, date, venue, price).
// EMS-F-005: pass `event` to edit an existing event instead (PUT /api/events/:id).
const EMPTY = { title: "", description: "", category: "", capacity: "", date: "", venue: "", price: "0" };

// ISO date -> the "yyyy-mm-ddThh:mm" local time a datetime-local input expects.
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function formFromEvent(event) {
  if (!event) return EMPTY;
  return {
    title: event.title ?? "",
    description: event.description ?? "",
    category: event.category ?? "",
    capacity: event.capacity == null ? "" : String(event.capacity),
    date: toLocalInput(event.date),
    venue: event.venue ?? "",
    price: String(event.price ?? 0),
  };
}

export default function CreateEvent({ onCreated, event: editing, onSaved, onCancel }) {
  const isEdit = Boolean(editing);
  const eventId = editing?.eventId ?? editing?._id;
  const [form, setForm] = useState(() => formFromEvent(editing));
  const [saved, setSaved] = useState(() => formFromEvent(editing));
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      capacity: Number(form.capacity),
      // datetime-local has no timezone; new Date() reads it as local time.
      date: form.date ? new Date(form.date).toISOString() : "",
      venue: form.venue.trim(),
      price: form.price === "" ? 0 : Number(form.price),
    };

    if (!payload.title || !payload.description || !payload.category) {
      setStatus("error");
      setMessage("Title, description and category are required.");
      return;
    }
    if (!payload.capacity || !payload.date || !payload.venue) {
      setStatus("error");
      setMessage("Capacity, date and venue are required to publish an event.");
      return;
    }

    // When editing, send only what changed (F-005).
    const body = isEdit
      ? Object.fromEntries(Object.entries(payload).filter(([key]) => form[key] !== saved[key]))
      : payload;
    if (isEdit && Object.keys(body).length === 0) {
      setStatus("idle");
      setMessage("No changes to save.");
      return;
    }

    setStatus("saving");
    try {
      const headers = { "Content-Type": "application/json", Accept: "application/json" };
      try {
        const token = localStorage.getItem("ems_token");
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch {
        // Storage may be unavailable; the API will determine authorization.
      }

      const response = await fetch(isEdit ? `/api/events/${eventId}` : "/api/events", {
        method: isEdit ? "PUT" : "POST",
        headers,
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail = Array.isArray(result.errors) && result.errors.length ? ` (${result.errors.join("; ")})` : "";
        throw new Error((result.message || `Could not ${isEdit ? "save" : "create"} event (HTTP ${response.status}).`) + detail);
      }

      setStatus("success");
      if (isEdit) {
        setForm(formFromEvent(result.event));
        setSaved(formFromEvent(result.event));
        setMessage("Changes saved.");
        if (onSaved) onSaved(result.event);
        return;
      }
      setForm(EMPTY);
      setMessage("Event created successfully.");
      if (onCreated) onCreated(result.event || result);
    } catch (error) {
      setStatus("error");
      setMessage(error.message || `Could not ${isEdit ? "save" : "create"} event.`);
    }
  }

  return (
    <section className="create-event card" aria-labelledby="create-event-heading">
      <h2 id="create-event-heading">{isEdit ? `Edit "${editing.title}"` : "Create an event"}</h2>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="create-event-title">Title</label>
          <input
            id="create-event-title"
            name="title"
            value={form.title}
            onChange={handleChange}
            maxLength={120}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="create-event-description">Description</label>
          <textarea
            id="create-event-description"
            name="description"
            value={form.description}
            onChange={handleChange}
            maxLength={2000}
            rows={3}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="create-event-category">Category</label>
          <select
            id="create-event-category"
            name="category"
            value={form.category}
            onChange={handleChange}
            required
          >
            <option value="">Choose a category</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="create-event-date">Date and time</label>
          <input
            id="create-event-date"
            name="date"
            type="datetime-local"
            value={form.date}
            onChange={handleChange}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="create-event-venue">Venue</label>
          <input
            id="create-event-venue"
            name="venue"
            value={form.venue}
            onChange={handleChange}
            maxLength={200}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="create-event-capacity">Capacity</label>
          <input
            id="create-event-capacity"
            name="capacity"
            type="number"
            min="1"
            step="1"
            value={form.capacity}
            onChange={handleChange}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="create-event-price">Price (INR, 0 = free)</label>
          <input
            id="create-event-price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={handleChange}
            required
          />
        </div>

        <button className="btn" type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : isEdit ? "Save changes" : "Create event"}
        </button>
        {isEdit && onCancel && (
          <button className="btn btn-secondary" type="button" onClick={onCancel}>
            Back to my events
          </button>
        )}
      </form>

      {message && (
        <p
          className={status === "error" ? "create-event-message error" : "create-event-message"}
          role={status === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </section>
  );
}
