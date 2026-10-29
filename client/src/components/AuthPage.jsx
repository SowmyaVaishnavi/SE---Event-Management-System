import React, { useState } from "react";
import Login from "./Login.jsx";
import Register from "./Register.jsx";

// Entry screen: Register (EMS-F-001) or Log in. A successful login opens the Browse page.
export default function AuthPage({ onAuthed }) {
  const [mode, setMode] = useState("register");
  const [notice, setNotice] = useState("");

  return (
    <div className="app auth-page">
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
