import React, { useState } from "react";

// EMS-F-001: register a new account (Attendee or Organizer) via POST /api/auth/register.
const EMPTY = { name: "", email: "", password: "", role: "Attendee" };

export default function Register({ onRegistered }) {
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    setStatus("saving");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Registration failed");
      setForm(EMPTY);
      setStatus("success");
      setMessage("Registration successful!");
      if (onRegistered) onRegistered(body.user);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof TypeError ? "Cannot connect to backend server" : err.message);
    }
  }

  return (
    <section className="register card" aria-labelledby="register-heading">
      <h2 id="register-heading">Create account</h2>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="reg-name">Full name</label>
          <input id="reg-name" name="name" value={form.name} onChange={handleChange} required />
        </div>
        <div className="field">
          <label htmlFor="reg-email">Email</label>
          <input id="reg-email" name="email" type="email" value={form.email} onChange={handleChange} required />
        </div>
        <div className="field">
          <label htmlFor="reg-password">Password</label>
          <input
            id="reg-password"
            name="password"
            type="password"
            minLength={8}
            placeholder="Minimum 8 characters"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="reg-role">Register as</label>
          <select id="reg-role" name="role" value={form.role} onChange={handleChange}>
            <option value="Attendee">Attendee</option>
            <option value="Organizer">Organizer</option>
          </select>
        </div>
        <button className="btn" type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Registering..." : "Register"}
        </button>
      </form>
      {message && (
        <p
          className={status === "error" ? "message error" : "message"}
          role={status === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </section>
  );
}
