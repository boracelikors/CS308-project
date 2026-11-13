// Unit tests for the guest-cart merge rules (no database needed)
const test = require("node:test");
const assert = require("node:assert/strict");
const { planMerge } = require("../cart/mergePlan");

const products = new Map([
  [1, { name: "Monitors", stock: 4, isActive: true }],
  [7, { name: "Soundbar", stock: 0, isActive: true }],
  [8, { name: "Towers", stock: 1, isActive: true }],
  [9, { name: "Old model", stock: 5, isActive: false }],
  [11, { name: "Microphone", stock: 15, isActive: true }],
]);

test("distinct products are added as new lines without adjustments", () => {
  const plan = planMerge([{ productId: 1, quantity: 2 }, { productId: 11, quantity: 3 }], new Map(), products);
  assert.deepEqual(plan, {
    writes: [
      { productId: 1, quantity: 2, isNew: true },
      { productId: 11, quantity: 3, isNew: true },
    ],
    adjustments: [],
  });
});

test("overlapping products add the guest quantity to the account quantity", () => {
  const plan = planMerge([{ productId: 11, quantity: 3 }], new Map([[11, 2]]), products);
  assert.deepEqual(plan.writes, [{ productId: 11, quantity: 5, isNew: false }]);
  assert.deepEqual(plan.adjustments, []);
});

test("the total is capped at the stock and the reduction is reported", () => {
  const plan = planMerge([{ productId: 1, quantity: 3 }], new Map([[1, 2]]), products);
  assert.deepEqual(plan.writes, [{ productId: 1, quantity: 4, isNew: false }]);
  assert.deepEqual(plan.adjustments, [
    { productId: 1, name: "Monitors", requested: 5, applied: 4, reason: "INSUFFICIENT_STOCK" },
  ]);
});

test("a new line larger than the stock is capped too", () => {
  const plan = planMerge([{ productId: 8, quantity: 3 }], new Map(), products);
  assert.deepEqual(plan.writes, [{ productId: 8, quantity: 1, isNew: true }]);
  assert.equal(plan.adjustments[0].applied, 1);
});

test("out-of-stock products are not added", () => {
  const plan = planMerge([{ productId: 7, quantity: 1 }], new Map(), products);
  assert.deepEqual(plan.writes, []);
  assert.deepEqual(plan.adjustments, [
    { productId: 7, name: "Soundbar", requested: 1, applied: 0, reason: "OUT_OF_STOCK" },
  ]);
});

test("unknown and off-sale products are not added", () => {
  const plan = planMerge([{ productId: 9, quantity: 1 }, { productId: 999, quantity: 2 }], new Map(), products);
  assert.deepEqual(plan.writes, []);
  assert.deepEqual(plan.adjustments, [
    { productId: 9, name: "Old model", requested: 1, applied: 0, reason: "PRODUCT_UNAVAILABLE" },
    { productId: 999, name: null, requested: 2, applied: 0, reason: "PRODUCT_UNAVAILABLE" },
  ]);
});

test("an account line already above the stock is never lowered by the merge", () => {
  // Stock dropped to 1 after the customer put 3 in the account cart
  const plan = planMerge([{ productId: 8, quantity: 1 }], new Map([[8, 3]]), products);
  assert.deepEqual(plan.writes, []);
  assert.deepEqual(plan.adjustments, [
    { productId: 8, name: "Towers", requested: 4, applied: 3, reason: "INSUFFICIENT_STOCK" },
  ]);
});

test("account lines are kept when the guest product is unavailable", () => {
  const plan = planMerge([{ productId: 7, quantity: 2 }], new Map([[7, 1]]), products);
  assert.deepEqual(plan.writes, []);
  assert.equal(plan.adjustments[0].applied, 1);
});