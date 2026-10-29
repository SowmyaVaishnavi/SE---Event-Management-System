import React, { useState } from "react";

// EMS-F-001 follow-up: log in via POST /api/auth/login.
export default function Login({ onLoggedIn, notice }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((c) => ({ ...c, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setStatus("saving");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Login failed");
      onLoggedIn(body.token, body.user);
    } catch (err) {
      setStatus("error");
      setError(err instanceof TypeError ? "Cannot connect to backend server" : err.message);
    }
  }

  return (
    <section className="register card" aria-labelledby="login-heading">
      <h2 id="login-heading">Log in</h2>
      {notice && <p className="message" role="status">{notice}</p>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input id="login-email" name="email" type="email" value={form.email} onChange={handleChange} required />
        </div>
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input id="login-password" name="password" type="password" value={form.password} onChange={handleChange} required />
        </div>
        <button className="btn" type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Logging in..." : "Log in"}
        </button>
      </form>
      {error && <p className="message error" role="alert">{error}</p>}
    </section>
  );
}
