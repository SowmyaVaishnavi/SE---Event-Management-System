import React, { useEffect, useState } from "react";
import Login from "./Login.jsx";
import Register from "./Register.jsx";

// Entry screen: Register (EMS-F-001) or Log in. A successful login opens the Browse page.
export default function AuthPage({ onAuthed }) {
  const [mode, setMode] = useState("register");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    document.title = `${mode === "register" ? "Create account" : "Log in"} - EMS`;
  }, [mode]);

  return (
    <div className="app auth-page">
      {/* Decorative showcase: hidden from assistive tech so the form stays the focus */}
      <div className="auth-showcase" aria-hidden="true">
        <p className="auth-kicker">Discover · Book · Celebrate</p>
        <h2>
          Every great moment <em>starts here.</em>
        </h2>
        <p className="auth-lede">
          Concerts, workshops, fests and talks happening around you. Find your next event and
          grab your spot in seconds.
        </p>
        <ul className="auth-chips">
          <li>🎤 Seminars</li>
          <li>💻 Technical</li>
          <li>🎭 Cultural</li>
          <li>🏆 Sports</li>
          <li>🛠️ Workshops</li>
          <li>🥂 Social</li>
        </ul>
        <ul className="auth-perks">
          <li>
            <span className="ico">🎟️</span>
            <span>
              <strong>Instant booking</strong>
              Reserve a seat with one click.
            </span>
          </li>
          <li>
            <span className="ico">📲</span>
            <span>
              <strong>QR tickets</strong>
              Show your code at the door and walk right in.
            </span>
          </li>
          <li>
            <span className="ico">🔔</span>
            <span>
              <strong>Stay in the loop</strong>
              Get alerts when plans change.
            </span>
          </li>
        </ul>
      </div>

      <header className="top">
        <div>
          <p className="eyebrow">Event Management System</p>
          <h1>{mode === "register" ? "Create your account" : "Welcome back"}</h1>
        </div>
      </header>
      <main>
        {mode === "register" ? (
          <Register onRegistered={() => { setNotice("Registration successful. Please log in."); setMode("login"); }} />
        ) : (
          <Login onLoggedIn={onAuthed} notice={notice} />
        )}
        <p className="auth-switch">
          {mode === "register" ? "Already have an account?" : "New here?"}{" "}
          <button type="button" className="link" onClick={() => { setNotice(""); setMode(mode === "register" ? "login" : "register"); }}>
            {mode === "register" ? "Log in" : "Register"}
          </button>
        </p>
      </main>
    </div>
  );
}
