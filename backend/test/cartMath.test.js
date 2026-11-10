const test = require("node:test");
const assert = require("node:assert/strict");
const { toMinorUnits, formatMinorUnits, validateQuantity, cartTotals } = require("../cart/cartMath");

test("toMinorUnits converts decimal strings exactly", () => {
  assert.equal(toMinorUnits("1499.90"), 149990);
  assert.equal(toMinorUnits("15000"), 1500000);
  assert.equal(toMinorUnits("0.05"), 5);
  assert.equal(toMinorUnits("12.5"), 1250);
  assert.equal(toMinorUnits(99.99), 9999);
});

test("toMinorUnits rejects invalid amounts", () => {
  for (const bad of ["1.999", "-5", "abc", "", null, 0.1 + 0.2]) {
    assert.throws(() => toMinorUnits(bad), /Invalid money amount/, `rejects ${bad}`);
  }
});

test("formatMinorUnits always shows two decimals", () => {
  assert.equal(formatMinorUnits(149990), "1499.90");
  assert.equal(formatMinorUnits(5), "0.05");
  assert.equal(formatMinorUnits(0), "0.00");
});

test("no floating point drift: 3 x 0.10 is exactly 0.30", () => {
  assert.notEqual(0.1 * 3, 0.3, "plain JS floats drift");
  const result = cartTotals([{ productId: 1, unitPrice: "0.10", currency: "TRY", quantity: 3 }]);
  assert.equal(result.subtotal, "0.30");
});

test("validateQuantity rejects non-positive and non-integer quantities", () => {
  for (const quantity of [0, -1, 1.5, "2", null]) {
    assert.equal(validateQuantity(quantity, 10).code, "INVALID_QUANTITY", `rejects ${quantity}`);
  }
});

test("validateQuantity reports out of stock and insufficient stock", () => {
  assert.equal(validateQuantity(1, 0).code, "OUT_OF_STOCK");
  const result = validateQuantity(6, 5);
  assert.equal(result.code, "INSUFFICIENT_STOCK");
  assert.equal(result.available, 5);
});

test("validateQuantity allows taking the last items in stock", () => {
  assert.equal(validateQuantity(5, 5).ok, true);
  assert.equal(validateQuantity(1, 1).ok, true);
});

test("cartTotals computes line totals and subtotal", () => {
  const result = cartTotals([
    { productId: 1, unitPrice: "1499.90", currency: "TRY", quantity: 2 },
    { productId: 2, unitPrice: "349.99", currency: "TRY", quantity: 1 },
  ]);
  assert.equal(result.lines[0].lineTotal, "2999.80");
  assert.equal(result.lines[1].lineTotal, "349.99");
  assert.equal(result.subtotal, "3349.79");
  assert.equal(result.currency, "TRY");
});

test("cartTotals handles an empty cart", () => {
  assert.deepEqual(cartTotals([]), { lines: [], subtotal: "0.00", currency: null });
});

test("cartTotals refuses mixed currencies", () => {
  assert.throws(
    () => cartTotals([
      { productId: 1, unitPrice: "10.00", currency: "TRY", quantity: 1 },
      { productId: 2, unitPrice: "10.00", currency: "EUR", quantity: 1 },
    ]),
    /same currency/
  );
});
