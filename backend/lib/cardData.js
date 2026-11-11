// EMS-SR-003: never accept or store raw payment card data (PCI-DSS, SAD 1.3 constraints).
// - rejectCardData: API middleware that refuses any request body carrying card details.
// - findCardData: used by `npm run audit:card-data` to scan the database (TC-Sec-03).

// Field names that only ever hold card details.
const CARD_KEY = /^(card[_-]?(number|no|num)|cc[_-]?(number|num)?|pan|cvv2?|cvc2?|security[_-]?code|exp(iry)?[_-]?(date|month|year)?|card[_-]?expiry)$/i;
// 13-19 digits, optionally grouped with spaces or dashes (how card numbers are typed), standing on their own:
// digits inside a word, id or email (e.g. "user1793436325041@x.dev") are not card numbers.
const DIGIT_RUN = /(?<![A-Za-z0-9_])(?:\d[ -]?){12,18}\d(?![A-Za-z0-9_@])/g;

function luhnValid(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

// True if the text contains something that looks like a real card number (length + Luhn check).
function hasCardNumber(text) {
  if (typeof text !== "string") return false;
  for (const match of text.match(DIGIT_RUN) || []) {
    const digits = match.replace(/[ -]/g, "");
    if (digits.length >= 13 && digits.length <= 19 && !/^(\d)\1+$/.test(digits) && luhnValid(digits)) return true;
  }
  return false;
}

// Walks a JSON-like value and returns the paths that hold card data, e.g. ["payment.cardNumber"].
function findCardData(value, path = "", out = [], depth = 0) {
  if (depth > 20 || value == null) return out;
  if (typeof value === "string") {
    if (hasCardNumber(value)) out.push(path || "(value)");
  } else if (typeof value === "number") {
    if (hasCardNumber(String(value))) out.push(path || "(value)");
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => findCardData(v, `${path}[${i}]`, out, depth + 1));
  } else if (typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    // ObjectIds and similar BSON values are not plain objects; skip them.
    if (value._bsontype) return out;
    for (const [key, v] of Object.entries(value)) {
      const here = path ? `${path}.${key}` : key;
      if (CARD_KEY.test(key) && v !== null && v !== "" && v !== undefined) out.push(here);
      else findCardData(v, here, out, depth + 1);
    }
  }
  return out;
}

function rejectCardData(req, res, next) {
  if (req.body && typeof req.body === "object" && findCardData(req.body).length) {
    // Do not log the body: it may contain the very card number we refuse to keep.
    return res.status(400).json({
      message: "Card details must be entered only on the payment provider's page. EMS never accepts card numbers.",
    });
  }
  next();
}

module.exports = { luhnValid, hasCardNumber, findCardData, rejectCardData };
