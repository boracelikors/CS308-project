// Unit tests for the POST /cart/merge input rules (no database needed)
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateMerge, requestHash, MAX_ITEMS, MAX_QUANTITY } = require("../cart/validateMerge");

const KEY = "3f1c2a9e-8b7d-4c6e-9f00-1a2b3c4d5e6f";

test("a valid body is accepted and items are sorted by product", () => {
  const result = validateMerge({ requestKey: KEY, items: [{ productId: 9, quantity: 1 }, { productId: 2, quantity: 3 }] });
  assert.deepEqual(result, {
    ok: true,
    value: { requestKey: KEY, items: [{ productId: 2, quantity: 3 }, { productId: 9, quantity: 1 }] },
  });
});

test("the same product listed twice becomes one line with the summed quantity", () => {
  const result = validateMerge({ requestKey: KEY, items: [{ productId: 4, quantity: 1 }, { productId: 4, quantity: 2 }] });
  assert.deepEqual(result.value.items, [{ productId: 4, quantity: 3 }]);
});

test("requestKey must be 8-64 letters, digits, - or _", () => {
  for (const requestKey of [undefined, "", "short", "a".repeat(65), "has space!", 12345678, null]) {
    const result = validateMerge({ requestKey, items: [{ productId: 1, quantity: 1 }] });
    assert.equal(result.ok, false, `requestKey=${requestKey}`);
    assert.ok(result.fields.requestKey);
  }
  assert.equal(validateMerge({ requestKey: "a".repeat(64), items: [{ productId: 1, quantity: 1 }] }).ok, true);
});

test("items must be a list of 1-50 products", () => {
  for (const items of [undefined, null, "1,2", {}, []]) {
    const result = validateMerge({ requestKey: KEY, items });
    assert.equal(result.ok, false);
    assert.ok(result.fields.items);
  }
  const tooMany = Array.from({ length: MAX_ITEMS + 1 }, (_, i) => ({ productId: i + 1, quantity: 1 }));
  assert.equal(validateMerge({ requestKey: KEY, items: tooMany }).ok, false);
  assert.equal(validateMerge({ requestKey: KEY, items: tooMany.slice(0, MAX_ITEMS) }).ok, true);
});

test("productId and quantity must be positive whole numbers; the bad index is named", () => {
  const bads = [
    { productId: 0, quantity: 1 },
    { productId: -3, quantity: 1 },
    { productId: "5", quantity: 1 },
    { productId: 1.5, quantity: 1 },
    { productId: 1, quantity: 0 },
    { productId: 1, quantity: -2 },
    { productId: 1, quantity: 2.5 },
    { productId: 1, quantity: "2" },
    { productId: 1, quantity: MAX_QUANTITY + 1 },
    { productId: 1 },
    null,
  ];
  for (const bad of bads) {
    const result = validateMerge({ requestKey: KEY, items: [{ productId: 1, quantity: 1 }, bad] });
    assert.equal(result.ok, false, JSON.stringify(bad));
    assert.match(result.fields.items, /items\[1\]/);
  }
});

test("both fields are reported at once; a missing body does not crash", () => {
  assert.deepEqual(Object.keys(validateMerge(null).fields).sort(), ["items", "requestKey"]);
  assert.deepEqual(Object.keys(validateMerge({}).fields).sort(), ["items", "requestKey"]);
});

test("client prices or totals in the body are ignored", () => {
  const result = validateMerge({
    requestKey: KEY,
    subtotal: "1.00",
    items: [{ productId: 1, quantity: 2, unitPrice: "0.01", lineTotal: "0.02" }],
  });
  assert.deepEqual(result.value, { requestKey: KEY, items: [{ productId: 1, quantity: 2 }] });
});

test("requestHash ignores order and splitting of lines but changes with the items", () => {
  const a = validateMerge({ requestKey: KEY, items: [{ productId: 1, quantity: 2 }, { productId: 3, quantity: 1 }] });
  const b = validateMerge({
    requestKey: KEY,
    items: [{ productId: 3, quantity: 1 }, { productId: 1, quantity: 1 }, { productId: 1, quantity: 1 }],
  });
  const c = validateMerge({ requestKey: KEY, items: [{ productId: 1, quantity: 3 }, { productId: 3, quantity: 1 }] });
  assert.equal(requestHash(a.value.items), requestHash(b.value.items));
  assert.notEqual(requestHash(a.value.items), requestHash(c.value.items));
  assert.match(requestHash(a.value.items), /^[0-9a-f]{64}$/);
});