// Unit tests for the pure invoice helpers (SCRUM-36). No database needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  invoiceNumber,
  lineTotal,
  sumLines,
  formatAmount,
  formatDate,
  mailErrorCode,
} = require("../invoices/invoiceFormat");

test("invoice numbers are built from the order ID and the issue year", () => {
  assert.equal(invoiceNumber(42, new Date(2026, 10, 13)), "INV-2026-000042");
  assert.equal(invoiceNumber(1234567, new Date(2027, 0, 1)), "INV-2027-1234567");
  assert.throws(() => invoiceNumber(0, new Date()));
  assert.throws(() => invoiceNumber("5", new Date()));
});

test("line totals and sums are exact, without floating point errors", () => {
  assert.equal(lineTotal("18749.90", 2), "37499.80");
  assert.equal(lineTotal("0.10", 3), "0.30"); // 0.1 * 3 is 0.30000000000000004 as a float
  assert.equal(
    sumLines([
      { unitPrice: "0.10", quantity: 1 },
      { unitPrice: "0.20", quantity: 1 },
    ]),
    "0.30"
  );
  assert.equal(sumLines([]), "0.00");
});

test("printed amounts keep two decimals and group thousands", () => {
  assert.equal(formatAmount("18749.90"), "18,749.90");
  assert.equal(formatAmount("1000000.00"), "1,000,000.00");
  assert.equal(formatAmount("999.5"), "999.50");
  assert.equal(formatAmount("0.05"), "0.05");
  assert.throws(() => formatAmount("12.345"));
});

test("dates are printed in Istanbul time", () => {
  // 22:30 UTC on 12 November is already 13 November in Istanbul (UTC+3)
  assert.equal(formatDate(new Date("2026-11-12T22:30:00Z")), "13.11.2026");
});

test("only short error codes are stored for failed emails, never messages", () => {
  assert.equal(mailErrorCode(Object.assign(new Error("x"), { code: "ECONNREFUSED" })), "ECONNREFUSED");
  assert.equal(mailErrorCode(Object.assign(new Error("x"), { code: "eauth" })), "EAUTH");
  assert.equal(mailErrorCode(new Error("550 mailbox ali@example.com unavailable")), "SEND_FAILED");
  assert.equal(mailErrorCode(Object.assign(new Error("x"), { code: "bad code with spaces" })), "SEND_FAILED");
  assert.equal(mailErrorCode(undefined), "SEND_FAILED");
});