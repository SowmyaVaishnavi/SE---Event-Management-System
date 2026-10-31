// EMS-NF-005 / TC-UX-01: WCAG 2.1 AA checks that can run automatically.
//  - axe-core on every screen (labels, roles, names, headings, landmarks, duplicate ids, ARIA)
//  - colour contrast of the real theme colours in styles.css, normal and high-contrast
// Not automated (checked by hand, see docs/ACCESSIBILITY.md): screen reader walk-through,
// 200% zoom, camera scanning, keyboard order on real devices.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import * as axeMatchers from "vitest-axe/matchers";
import App from "../App.jsx";
import AuthPage from "../components/AuthPage.jsx";

expect.extend(axeMatchers);

// jsdom has no layout engine, so axe cannot compute colours. Contrast is tested below instead.
const AXE_OPTIONS = { rules: { "color-contrast": { enabled: false } } };

const future = new Date(Date.now() + 3 * 864e5).toISOString();
const EVENTS = [
  { eventId: "e1", title: "Tech Talk", description: "A talk", category: "Technical", venue: "Main Hall", date: future, price: 0, capacity: 50, registeredCount: 10, status: "published" },
];
const TICKETS = [
  { bookingId: "b1", ticketCode: "EMS-ABCD-EFGH-JKLM", status: "confirmed", checkedInAt: null, event: { title: "Tech Talk", category: "Technical", date: future, venue: "Main Hall" } },
];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    const body = String(url).includes("/api/bookings/me") ? { tickets: TICKETS } : { events: EVENTS };
    return { ok: true, status: 200, json: async () => body };
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("axe: no automatic WCAG violations", () => {
  it("register page", async () => {
    const { container } = render(<AuthPage onAuthed={() => {}} />);
    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
    expect(document.title).toBe("Create account - EMS");
  });

  it("login page", async () => {
    const { container } = render(<AuthPage onAuthed={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
    expect(document.title).toBe("Log in - EMS");
  });

  it("browse events (attendee)", async () => {
    const { container } = render(<App user={{ name: "Asha", role: "Attendee" }} onLogout={() => {}} />);
    await screen.findByText("Tech Talk");
    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
    expect(document.title).toBe("Upcoming events - EMS");
  });

  it("my tickets (attendee)", async () => {
    const { container } = render(<App user={{ name: "Asha", role: "Attendee" }} onLogout={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "My tickets" }));
    await screen.findByText("EMS-ABCD-EFGH-JKLM");
    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
    expect(document.title).toBe("My tickets - EMS");
  });

  it("create event and check-in (organizer)", async () => {
    const { container } = render(<App user={{ name: "Om", role: "Organizer" }} onLogout={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Create event" }));
    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("button", { name: "Check-in" }));
    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
    expect(document.title).toBe("Event check-in - EMS");
  });
});

describe("keyboard and screen reader behaviour", () => {
  it("skip link points at the main content, which exists on every view", async () => {
    render(<App user={{ name: "Asha", role: "Attendee" }} onLogout={() => {}} />);
    const skip = screen.getByRole("link", { name: /skip to main content/i });
    expect(skip).toHaveAttribute("href", "#main");
    expect(document.getElementById("main")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "My tickets" }));
    expect(document.getElementById("main")).toBeInTheDocument();
  });

  it("moves focus to the new content when the view changes, and the h1 names the view", async () => {
    render(<App user={{ name: "Asha", role: "Attendee" }} onLogout={() => {}} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Upcoming events");
    await userEvent.click(screen.getByRole("button", { name: "My tickets" }));
    await waitFor(() => expect(document.getElementById("main")).toHaveFocus());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("My tickets");
  });

  it("sign-in fields tell the browser what they are for (WCAG 1.3.5)", async () => {
    render(<AuthPage onAuthed={() => {}} />);
    expect(screen.getByLabelText("Full name")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "new-password");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
  });
});

// ---- colour contrast, computed from the real CSS ----
const css = fs.readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");
function themeVars(selector) {
  const block = css.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`))[1];
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("colour contrast (WCAG 1.4.3 text 4.5:1, 1.4.11 controls and focus 3:1)", () => {
  const normal = themeVars(":root");
  const high = { ...normal, ...themeVars(".high-contrast") };
  for (const [name, t] of [["normal", normal], ["high contrast", high]]) {
    it(`${name} theme`, () => {
      const text = [["text", "bg"], ["text", "surface"], ["muted", "bg"], ["muted", "surface"], ["accent-text", "accent"], ["accent", "surface"], ["ok", "surface"], ["warn", "surface"], ["danger", "surface"]];
      for (const [fg, bg] of text) expect(ratio(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      const ui = [["control-border", "surface"], ["control-border", "bg"], ["focus", "surface"], ["focus", "bg"]];
      for (const [fg, bg] of ui) expect(ratio(t[fg], t[bg]), `${fg} against ${bg}`).toBeGreaterThanOrEqual(3);
    });
  }
});
