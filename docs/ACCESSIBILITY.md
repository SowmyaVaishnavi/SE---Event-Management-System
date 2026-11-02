# Accessibility - WCAG 2.1 AA (EMS-NF-005, test TC-UX-01)

Owner: Product Owner. Scope: every screen in the React client (register, log in, browse and filter, create event, book, My tickets, check-in).

## What was found and fixed

| # | WCAG | Problem found in the Sprint 1 UI | Fix |
|---|------|----------------------------------|-----|
| 1 | 1.4.11 Non-text contrast | Input, select and secondary-button borders were `#d5dae2` on white (1.4:1; 3:1 needed). | New `--control-border` (`#667085`, 5.0:1). Card edges stay light because they are decoration. |
| 2 | 1.4.11 / 2.4.7 Focus visible | Focus ring was orange `#f5a300` (2.1:1 on white). | Focus ring is now `#0b3fb8` (8.1:1). In high-contrast mode it is yellow on black. |
| 3 | 2.4.1 Bypass blocks | "Skip to events" pointed at `#results`, which only exists on the Browse view. | One skip link to `#main`, present on every view. |
| 4 | 2.4.2 Page titled | One title for every page ("EMS - Browse Events"). | Each view sets its own title, e.g. "My tickets - EMS". |
| 5 | 2.4.6 / 1.3.1 Headings | The `h1` always said "Upcoming events", even on My tickets or Check-in. Event cards were `h3` directly under `h1`. | `h1` names the current view. Event cards are `h2`. Sub-headings no longer repeat the `h1`. |
| 6 | 2.4.3 / 4.1.3 | After choosing a tab, focus stayed on the tab and nothing told a screen reader the page had changed. | Focus moves to the main content when the view changes. |
| 7 | 1.3.5 Input purpose | Name, email and password fields had no `autocomplete`. | `name`, `email`, `new-password`, `current-password`. |
| 8 | 1.4.10 Reflow | At 320 px wide the event grid and filter bar were wider than the screen (fixed 290 px / 170 px minimum columns). | `minmax(min(290px, 100%), 1fr)`. |
| 9 | 2.3.3 (AAA, done anyway) | Fade transitions ignored the reduced-motion setting. | `prefers-reduced-motion` turns them off. |

Already fine in Sprint 1: every field has a visible label, errors and results are announced (`role="alert"` / `role="status"`), the page language is set, text colours pass 4.5:1 in both themes, and a High contrast switch exists.

New screens (booking, tickets, check-in) were built with labels, live messages, a text alternative on each QR image (includes the ticket code), and a confirmation step that keeps focus order logical.

## Automated checks (run with `npm test` in `client`)

`src/test/a11y.test.jsx`:
- axe-core on: register, log in, browse, My tickets, create event, check-in. No violations.
- Real colour contrast computed from `styles.css` for the normal and the high-contrast theme (text 4.5:1, controls and focus 3:1). This test fails if someone changes a colour to something too light.
- Skip link, focus after a view change, page titles, `autocomplete`.

Limit: axe running in jsdom cannot see rendered colours, so `color-contrast` is switched off there and covered by the colour test plus the Lighthouse run below.

## Manual checks (do before the demo, about 15 minutes) - record the result in the right-hand column

| # | Check | How | Result |
|---|-------|-----|--------|
| M1 | Lighthouse accessibility score | Chrome, F12, Lighthouse tab, Accessibility only, run once on Browse, once on My tickets, once on Check-in, once on Register. Target 95+ and no contrast failures. | |
| M2 | Keyboard only | Unplug the mouse idea: use Tab / Shift+Tab / Enter / Space. You can register, log in, book, open My tickets, cancel (with the Yes/Keep buttons) and check in. Focus ring is always visible. | |
| M3 | Skip link | Reload, press Tab once: "Skip to main content" appears; Enter jumps past the header. | |
| M4 | Zoom | Browser at 200% and at 400%: no sideways scrolling, nothing cut off. | |
| M5 | High contrast switch | Turn it on in every view: text, borders, badges and the QR code are readable. | |
| M6 | Screen reader | Windows Narrator (Win+Ctrl+Enter) or NVDA: log in, book a spot, hear "Booked!", open My tickets, hear the QR description. | |
| M7 | Colour alone | Cancelled and checked-in tickets say so in words, not only by colour. (Built that way; just confirm.) | |

Anything that fails goes into DEVIATIONS.md as a new row.
