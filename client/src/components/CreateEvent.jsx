import React, { useState } from "react";
import { CATEGORIES } from "../config.js";

// EMS-F-004: create an event through the existing /api/events endpoint.
export default function CreateEvent({ onCreated }) {
  const [form, setForm] = useState({ title: "", description: "", category: "" });
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
    };

    if (!payload.title || !payload.description || !payload.category) {
      setStatus("error");
      setMessage("Title, description and category are required.");
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

      const response = await fetch("/api/events", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.message || `Could not create event (HTTP ${response.status}).`);
      }

      setForm({ title: "", description: "", category: "" });
      setStatus("success");
      setMessage("Event created successfully.");
      if (onCreated) onCreated(body.event || body);
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Could not create event.");
    }
  }

  return (
    <section className="create-event card" aria-labelledby="create-event-heading">
      <h2 id="create-event-heading">Event details</h2>
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

        <button className="btn" type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Creating..." : "Create event"}
        </button>
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
