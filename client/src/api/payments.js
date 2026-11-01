// Payments API for EMS-F-013 (pay), F-014 (receipt), F-015 (refund, Admin). See docs/PAYMENTS.md.
// Card details are never sent here (EMS-SR-003): they are typed only on the gateway's own page.
function authHeaders() {
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  try {
    const token = localStorage.getItem("ems_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* storage unavailable */
  }
  return headers;
}

async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, { method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error("Cannot connect to backend server");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Request failed (HTTP ${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const id = (paymentId) => encodeURIComponent(paymentId);

export const sandboxCheckout = (paymentId, outcome) => request("POST", `/api/payments/${id(paymentId)}/sandbox-checkout`, { outcome });
export const confirmPayment = (paymentId, gatewayResult) => request("POST", `/api/payments/${id(paymentId)}/confirm`, gatewayResult);
export const failPayment = (paymentId, reason) => request("POST", `/api/payments/${id(paymentId)}/fail`, { reason });
export const fetchReceipt = async (paymentId) => (await request("GET", `/api/payments/${id(paymentId)}/receipt`)).receipt;
export const fetchAllPayments = async (status) => (await request("GET", `/api/payments${status ? `?status=${encodeURIComponent(status)}` : ""}`)).payments ?? [];
export const refundPayment = (paymentId, reason) => request("POST", `/api/payments/${id(paymentId)}/refund`, reason ? { reason } : {});

// Razorpay Checkout (only when the backend is configured with Razorpay keys).
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error("Could not load the payment page. Check your connection and try again."));
    document.body.appendChild(script);
  });
}

// Opens Razorpay's own payment popup. Resolves with { paymentId, signature } on success.
export async function openRazorpay(checkout, { title, name, email }) {
  const Razorpay = await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: checkout.keyId,
      order_id: checkout.orderId,
      amount: checkout.amount,
      currency: checkout.currency,
      name: "Event Management System",
      description: title,
      prefill: { name, email },
      handler: (r) => resolve({ paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
      modal: { ondismiss: () => reject(Object.assign(new Error("Payment window closed before paying"), { dismissed: true })) },
    });
    rzp.on("payment.failed", (r) => reject(new Error(r?.error?.description || "Payment failed")));
    rzp.open();
  });
}
