
import { useState } from "react";
import "./App.css";

function App() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "Attendee"
  });

  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage("Registration successful!");
        setForm({
          name: "",
          email: "",
          password: "",
          role: "Attendee"
        });
      } else {
        setMessage(data.message || "Registration failed");
      }
    } catch {
      setMessage("Cannot connect to backend server");
    }
  };

  return (
    <div className="container">
      <form className="register-form" onSubmit={handleSubmit}>
        <h1>Event Management System</h1>
        <h2>Create Account</h2>

        <label>Full Name</label>
        <input
          name="name"
          placeholder="Enter your name"
          value={form.name}
          onChange={handleChange}
          required
        />

        <label>Email</label>
        <input
          name="email"
          type="email"
          placeholder="Enter your email"
          value={form.email}
          onChange={handleChange}
          required
        />

        <label>Password</label>
        <input
          name="password"
          type="password"
          placeholder="Minimum 8 characters"
          minLength="8"
          value={form.password}
          onChange={handleChange}
          required
        />

        <label>Register As</label>
        <select
          name="role"
          value={form.role}
          onChange={handleChange}
        >
          <option value="Attendee">Attendee</option>
          <option value="Organizer">Organizer</option>
        </select>

        <button type="submit">Register</button>

        {message && <p>{message}</p>}
      </form>
    </div>
  );
}

export default App;
