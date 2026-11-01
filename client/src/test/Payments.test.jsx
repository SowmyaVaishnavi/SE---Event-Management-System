// EMS-F-013 pay, F-014 receipt, F-015 Admin refund (sandbox gateway, fetch mocked).
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import MyTickets from "../components/MyTickets.jsx";
import AdminPayments from "../components/AdminPayments.jsx";

vi.mock("qrcode", () => ({ default: { toDataURL: () => Promise.resolve("data:image/png;base64,") } }));

const EVENT = { eventId: "e1", title: "Music Night", category: "Cultural", date: "2099-03-10T14:00:00.000Z", venue: "Open Air Theatre", price: 499.5 };
const RECEIPT = {
  receiptNumber: "RCPT-20990301-AB12CD", status: "paid", amount: 499.5, amountText: "₹499.50", currency: "INR",
  paidAt: "2099-03-01T10:00:00.000Z", paymentReference: "pay_sbx_1", provider: "sandbox",
  event: { eventId: "e1", title: "Music Night", date: EVENT.date, venue: EVENT.venue },
  attendee: { name: "Asha", email: "asha@example.com" }, ticketCode: "EMS-AAAA-BBBB-CCCC",
};

const pendingTicket = {
  bookingId: "b1", ticketCode: "EMS-AAAA-BBBB-CCCC", status: "pending_payment", checkedInAt: null,
  holdExpiresAt: "2099-03-01T10:15:00.000Z", event: EVENT,
  payment: { paymentId: "p1", status: "created", amount: 499.5, provider: "sandbox", checkout: { provider: "sandbox" } },
};
const paidTicket = { ...pendingTicket, status: "confirmed", payment: { ...pendingTicket.payment, status: "paid", receiptNumber: RECEIPT.receiptNumber } };

afterEach(() => vi.restoreAllMocks());

test("TC-Pay-01/02: pay for a held seat, then the receipt shows amount, event and date", async () => {
  let paid = false;
  const calls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts = {}) => {
    calls.push({ url, body: opts.body ? JSON.parse(opts.body) : null });
    if (url === "/api/bookings/me") return new Response(JSON.stringify({ tickets: [paid ? paidTicket : pendingTicket] }), { status: 200 });
    if (url === "/api/payments/p1/sandbox-checkout") return new Response(JSON.stringify({ orderId: "o1", paymentId: "pay_sbx_1", signature: "sig" }), { status: 200 });
    if (url === "/api/payments/p1/confirm") {
      paid = true;
      return new Response(JSON.stringify({ status: "paid", message: "Payment successful. Your booking is confirmed.", receipt: RECEIPT }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  });

  render(<MyTickets user={{ name: "Asha", email: "asha@example.com" }} />);
  expect(await screen.findByText("Payment pending")).toBeInTheDocument();
  expect(screen.getByText(/Payment needed: ₹499.50/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Pay ₹499.50" }));

  const receipt = await screen.findByRole("region", { name: "Payment receipt" });
  expect(within(receipt).getByText("RCPT-20990301-AB12CD")).toBeInTheDocument();
  expect(within(receipt).getByText("₹499.50")).toBeInTheDocument();
  expect(within(receipt).getAllByText("Music Night").length).toBeGreaterThan(0);
  expect(screen.getByText("Confirmed")).toBeInTheDocument();
  expect(calls.find((c) => c.url === "/api/payments/p1/confirm").body).toEqual({ orderId: "o1", paymentId: "pay_sbx_1", signature: "sig" });
  // EMS-SR-003: nothing that looks like card data was ever sent.
  expect(JSON.stringify(calls)).not.toMatch(/card|cvv|\d{13,19}/i);
});

test("a declined payment releases the seat and says so", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (url === "/api/bookings/me") return new Response(JSON.stringify({ tickets: [pendingTicket] }), { status: 200 });
    if (url === "/api/payments/p1/sandbox-checkout") return new Response(JSON.stringify({ message: "Payment declined by the test gateway" }), { status: 402 });
    if (url === "/api/payments/p1/fail") return new Response(JSON.stringify({ status: "failed", message: "Your seat was released." }), { status: 200 });
    return new Response("{}", { status: 404 });
  });
  render(<MyTickets user={{ name: "Asha" }} />);
  await userEvent.click(await screen.findByRole("button", { name: "Simulate a failed payment" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Payment declined by the test gateway. Your seat was released.");
});

test("TC-Pay-03: an Admin refunds an eligible payment", async () => {
  let refunded = false;
  const calls = [];
  const row = { paymentId: "p1", amount: 499.5, status: "paid", paidAt: "2099-03-01T10:00:00.000Z", receiptNumber: RECEIPT.receiptNumber, event: { title: "Music Night", status: "cancelled" }, attendee: { name: "Asha", email: "asha@example.com" }, bookingStatus: "cancelled", refundable: true };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts = {}) => {
    calls.push({ url, method: opts.method, body: opts.body ? JSON.parse(opts.body) : null });
    if (url === "/api/payments/p1/refund") {
      refunded = true;
      return new Response(JSON.stringify({ status: "refunded", message: "Refund completed and the attendee was told." }), { status: 200 });
    }
    return new Response(JSON.stringify({ payments: refunded ? [] : [row] }), { status: 200 });
  });

  render(<AdminPayments />);
  expect(await screen.findByText(/event cancelled/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /refund ₹499.50 to asha/i }));
  await userEvent.type(screen.getByLabelText(/Reason/), "Event cancelled");
  await userEvent.click(screen.getByRole("button", { name: "Yes, refund" }));
  expect(await screen.findByText(/Refund completed and the attendee was told/)).toBeInTheDocument();
  expect(calls.find((c) => c.url === "/api/payments/p1/refund")).toMatchObject({ method: "POST", body: { reason: "Event cancelled" } });
});
