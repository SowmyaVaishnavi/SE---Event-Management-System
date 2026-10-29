import React, { useState } from "react";
import App from "./App.jsx";
import AuthPage from "./components/AuthPage.jsx";

function loadUser() {
  try {
    return localStorage.getItem("ems_token") ? JSON.parse(localStorage.getItem("ems_user")) : null;
  } catch {
    return null;
  }
}

// Gate: not logged in -> Register/Login; logged in -> Browse events page.
export default function Root() {
  const [user, setUser] = useState(loadUser);

  function handleAuthed(token, nextUser) {
    try {
      localStorage.setItem("ems_token", token);
      localStorage.setItem("ems_user", JSON.stringify(nextUser));
    } catch {
      /* storage unavailable: session lasts until reload */
    }
    setUser(nextUser);
  }

  function handleLogout() {
    try {
      localStorage.removeItem("ems_token");
      localStorage.removeItem("ems_user");
    } catch {
      /* ignore */
    }
    setUser(null);
  }

  return user ? <App user={user} onLogout={handleLogout} /> : <AuthPage onAuthed={handleAuthed} />;
}
