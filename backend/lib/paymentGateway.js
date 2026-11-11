// Payment Gateway adapter (SAD 3.2 "Payment & Notification Service"). See docs/PAYMENTS.md.
//
// EMS never sees card details (EMS-SR-003): the attendee pays on the gateway's own page/popup,
// and EMS only stores the gateway's order id, payment id and the amount.
//
// Providers:
//  - "razorpay": used when RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set (test keys "rzp_test_..." for the demo).
//  - "sandbox":  built-in test gateway (default). No money moves; the checkout is simulated by
//                POST /api/payments/:id/sandbox-checkout, which returns a signed payment id like a real gateway.
const crypto = require("crypto");

const RAZORPAY_API = "https://api.razorpay.com/v1";

const hmac = (secret, data) => crypto.createHmac("sha256", secret).update(data).digest("hex");

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const randomId = (prefix) => `${prefix}_${crypto.randomBytes(9).toString("base64url")}`;

function sandboxGateway(env) {
  // Separate from JWT_SECRET use: derive a key just for signing sandbox payments.
  const secret = hmac(env.JWT_SECRET || "ems-sandbox", "ems-sandbox-gateway");
  return {
    name: "sandbox",
    async createOrder({ amountPaise, currency, receipt }) {
      return { orderId: randomId("order_sbx"), checkout: { provider: "sandbox", amount: amountPaise, currency, receipt } };
    },
    // Stands in for the gateway's hosted checkout page. Takes an outcome, never card details.
    simulateCheckout(orderId, outcome) {
      if (outcome !== "success") return { ok: false, reason: "Payment declined by the test gateway" };
      const paymentId = randomId("pay_sbx");
      return { ok: true, paymentId, signature: hmac(secret, `${orderId}|${paymentId}`) };
    },
    verifyPayment({ orderId, paymentId, signature }) {
      return Boolean(orderId && paymentId && signature) && safeEqual(hmac(secret, `${orderId}|${paymentId}`), signature);
    },
    async refund({ paymentId }) {
      return { refundId: randomId(`rfnd_sbx_${String(paymentId).slice(-6)}`) };
    },
  };
}

function razorpayGateway(env, fetchImpl) {
  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;
  const auth = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

  async function call(path, body) {
    const res = await fetchImpl(`${RAZORPAY_API}${path}`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data?.error?.description || `Payment gateway error (HTTP ${res.status})`);
      error.gateway = true;
      throw error;
    }
    return data;
  }

  return {
    name: "razorpay",
    async createOrder({ amountPaise, currency, receipt }) {
      const order = await call("/orders", { amount: amountPaise, currency, receipt });
      return { orderId: order.id, checkout: { provider: "razorpay", keyId, orderId: order.id, amount: amountPaise, currency } };
    },
    // Razorpay signs "order_id|payment_id" with the key secret (Razorpay Checkout docs).
    verifyPayment({ orderId, paymentId, signature }) {
      return Boolean(orderId && paymentId && signature) && safeEqual(hmac(keySecret, `${orderId}|${paymentId}`), signature);
    },
    async refund({ paymentId, amountPaise }) {
      const refund = await call(`/payments/${encodeURIComponent(paymentId)}/refund`, { amount: amountPaise });
      return { refundId: refund.id };
    },
  };
}

function getGateway(env = process.env, fetchImpl = globalThis.fetch) {
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) return razorpayGateway(env, fetchImpl);
  return sandboxGateway(env);
}

module.exports = { getGateway, sandboxGateway, razorpayGateway, hmac };
