// Unit tests for checkout input checks and the mock bank (SCRUM-34). No database needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateCheckout,
  validateIdempotencyKey,
  requestHash,
  luhnValid,
} = require("../checkout/validateCheckout");
const { createMockBank, DECLINED_CARD } = require("../payment/mockBank");

const NOW = new Date("2026-11-12T12:00:00Z");

const PAYMENT = { cardholderName: "Test Customer", cardNumber: "4242 4242 4242 4242", expiryMonth: 12, expiryYear: 2030, cvc: "123" };
const body = (overrides = {}) => ({
  requestKey: "3f1c2a9e-8b7d-4c6e-9f00-1a2b3c4d5e6f",
  expectedTotal: "37499.80",
  payment: PAYMENT,
  ...overrides,
});

test("a complete request is accepted and the card number is normalized", () => {
  const result = validateCheckout(body(), NOW);
  assert.equal(result.ok, true);
  assert.equal(result.value.card.number, "4242424242424242");
  assert.equal(result.value.requestKey, "3f1c2a9e-8b7d-4c6e-9f00-1a2b3c4d5e6f");
  assert.equal(result.value.deliveryAddress, null); // falls back to the home address later
});

test("delivery address is optional but must be 10-255 characters when sent", () => {
  assert.equal(validateCheckout(body({ deliveryAddress: "Short" }), NOW).ok, false);
  const ok = validateCheckout(body({ deliveryAddress: "  Orta Mah. Universite Cad. No:27, Tuzla  " }), NOW);
  assert.equal(ok.value.deliveryAddress, "Orta Mah. Universite Cad. No:27, Tuzla");
});

test("expectedTotal must look like a money amount", () => {
  for (const bad of [undefined, "", "37499.8", "abc", 37499.8, "-1.00"]) {
    const result = validateCheckout(body({ expectedTotal: bad }), NOW);
    assert.equal(result.ok, false, String(bad));
    assert.ok(result.fields.expectedTotal);
  }
});

test("invalid payment fields are reported with the form's field names, without echoing the card number", () => {
  const result = validateCheckout(
    body({ payment: { cardholderName: "", cardNumber: "4242424242424241", expiryMonth: 13, expiryYear: 2030, cvc: "12" } }),
    NOW
  );
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.fields).sort(), ["cardNumber", "cardholderName", "cvc", "expiry"]);
  assert.ok(!JSON.stringify(result).includes("4242424242424241"));
});

test("expired cards are rejected; the current month is still valid", () => {
  const expired = validateCheckout(body({ payment: { ...PAYMENT, expiryMonth: 10, expiryYear: 2026 } }), NOW);
  assert.equal(expired.fields.expiry, "This card has expired.");
  assert.equal(validateCheckout(body({ payment: { ...PAYMENT, expiryMonth: 11, expiryYear: 2026 } }), NOW).ok, true);
});

test("missing body or card is a validation error, not a crash", () => {
  assert.equal(validateCheckout(undefined, NOW).ok, false);
  assert.equal(validateCheckout({ requestKey: "key-12345678", expectedTotal: "1.00", payment: "x" }, NOW).ok, false);
});

test("Luhn checksum", () => {
  assert.equal(luhnValid("4242424242424242"), true);
  assert.equal(luhnValid(DECLINED_CARD), true);
  assert.equal(luhnValid("4242424242424241"), false);
});

test("requestKey is required and must look like a key", () => {
  assert.ok(validateCheckout(body({ requestKey: undefined }), NOW).fields.requestKey);
  assert.ok(validateCheckout(body({ requestKey: "short" }), NOW).fields.requestKey);

  assert.equal(validateIdempotencyKey("3f1c2a9e-8b7d-4c6e-9f00-1a2b3c4d5e6f"), true);
  assert.equal(validateIdempotencyKey("short"), false);
  assert.equal(validateIdempotencyKey("has space in it"), false);
  assert.equal(validateIdempotencyKey(undefined), false);
});

test("request hash changes with the input and never contains the card number or CVV", () => {
  const a = validateCheckout(body(), NOW).value;
  const b = validateCheckout(body({ expectedTotal: "1.00" }), NOW).value;
  assert.equal(requestHash(a), requestHash(validateCheckout(body(), NOW).value));
  assert.notEqual(requestHash(a), requestHash(b));
  assert.match(requestHash(a), /^[0-9a-f]{64}$/);
});

test("mock bank: test decline card is declined, others approved with a reference and last4", async () => {
  const bank = createMockBank();
  const declined = await bank.charge({ amountMinor: 100, card: { number: DECLINED_CARD } });
  assert.deepEqual(declined, { approved: false, reason: "card_declined" });

  const approved = await bank.charge({ amountMinor: 100, card: { number: "4242424242424242" } });
  assert.equal(approved.approved, true);
  assert.match(approved.reference, /^MOCK-/);
  assert.equal(approved.cardLast4, "4242");
  assert.equal(bank.capturedCount(), 1);

  await bank.void(approved.reference);
  assert.equal(bank.capturedCount(), 0);
});
