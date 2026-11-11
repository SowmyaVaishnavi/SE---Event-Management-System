// EMS-SR-003 / TC-Sec-03: card number detection used by the API guard and the DB audit.
const test = require("node:test");
const assert = require("node:assert");
const { luhnValid, hasCardNumber, findCardData } = require("../lib/cardData");

test("Luhn check on known test card numbers", () => {
  for (const n of ["4111111111111111", "5555555555554444", "378282246310005", "6011111111111117", "4000056655665556"]) {
    assert.strictEqual(luhnValid(n), true, n);
  }
  assert.strictEqual(luhnValid("4111111111111112"), false);
});

test("finds card numbers typed with spaces or dashes, ignores ordinary numbers", () => {
  assert.ok(hasCardNumber("pay with 4111 1111 1111 1111 please"));
  assert.ok(hasCardNumber("5555-5555-5555-4444"));
  assert.strictEqual(hasCardNumber("Call 9876543210"), false, "phone number");
  assert.strictEqual(hasCardNumber("order_sbx_123456789012"), false, "too short");
  assert.strictEqual(hasCardNumber("0000000000000000"), false, "repeated digit");
  assert.strictEqual(hasCardNumber("Booked 2026-11-05T10:00:00.000Z"), false, "date");
  assert.strictEqual(hasCardNumber("4111111111111112"), false, "fails Luhn");
  // A Luhn-valid number inside an email or id (e.g. a timestamp) is not a card number.
  assert.strictEqual(hasCardNumber("org4111111111111111@test.dev"), false, "digits inside an email");
  assert.strictEqual(hasCardNumber("pay_4111111111111111"), false, "digits inside an id");
  assert.ok(hasCardNumber("card: 4111111111111111."), "number at the end of a sentence");
});

test("findCardData reports card fields and card numbers anywhere in a document", () => {
  assert.deepStrictEqual(findCardData({ title: "Gig", price: 499 }), []);
  assert.deepStrictEqual(findCardData({ payment: { cardNumber: "x" } }), ["payment.cardNumber"]);
  assert.deepStrictEqual(findCardData({ cvv: 123 }), ["cvv"]);
  assert.deepStrictEqual(findCardData({ notes: ["ok", "card 4111111111111111"] }), ["notes[1]"]);
  assert.deepStrictEqual(findCardData({ amountPaise: 49950, providerOrderId: "order_ABC", receiptNumber: "RCPT-20261101-AB12CD" }), []);
  assert.deepStrictEqual(findCardData({ cardNumber: null, cvv: "" }), [], "empty card fields are not data");
});
