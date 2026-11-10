// Cart response building and line problems (no database needed)
const test = require("node:test");
const assert = require("node:assert/strict");
const { lineProblem, buildCartView } = require("../cart/cartStore");

const row = (overrides = {}) => ({
  productId: 1,
  name: "Studio Monitor",
  image: "speaker.jpg",
  price: "1499.90", // MySQL returns DECIMAL columns as strings
  currency: "TRY",
  quantity: 2,
  stock: 7,
  isActive: 1, // MySQL returns booleans as 1/0
  ...overrides,
});

test("lineProblem: normal line has no problem", () => {
  assert.equal(lineProblem({ isActive: true, stock: 5, quantity: 5 }), null);
});

test("lineProblem: removed from sale, out of stock, too few left", () => {
  assert.equal(lineProblem({ isActive: false, stock: 5, quantity: 1 }), "UNAVAILABLE");
  assert.equal(lineProblem({ isActive: true, stock: 0, quantity: 1 }), "OUT_OF_STOCK");
  assert.equal(lineProblem({ isActive: true, stock: 2, quantity: 3 }), "INSUFFICIENT_STOCK");
});

test("lineProblem: unavailable wins over stock problems", () => {
  assert.equal(lineProblem({ isActive: false, stock: 0, quantity: 3 }), "UNAVAILABLE");
});

test("empty cart", () => {
  assert.deepEqual(buildCartView([]), { items: [], subtotal: "0.00", currency: null });
});

test("line totals and subtotal are exact decimal strings", () => {
  const cart = buildCartView([row(), row({ productId: 2, price: "0.10", quantity: 3 })]);
  assert.equal(cart.items[0].lineTotal, "2999.80");
  assert.equal(cart.items[1].lineTotal, "0.30");
  assert.equal(cart.subtotal, "3000.10");
  assert.equal(cart.currency, "TRY");
});

test("a line has every field from the API draft", () => {
  const [item] = buildCartView([row()]).items;
  assert.deepEqual(item, {
    productId: 1,
    name: "Studio Monitor",
    image: "speaker.jpg",
    unitPrice: "1499.90",
    currency: "TRY",
    quantity: 2,
    lineTotal: "2999.80",
    stock: 7,
    problem: null,
  });
});

test("lines with a problem are shown but not counted in the subtotal", () => {
  const cart = buildCartView([
    row({ productId: 1, price: "100.00", quantity: 1 }),
    row({ productId: 2, price: "50.00", quantity: 5, stock: 2 }),
    row({ productId: 3, price: "70.00", quantity: 1, stock: 0 }),
    row({ productId: 4, price: "30.00", quantity: 1, isActive: 0 }),
  ]);
  assert.deepEqual(
    cart.items.map((i) => i.problem),
    [null, "INSUFFICIENT_STOCK", "OUT_OF_STOCK", "UNAVAILABLE"]
  );
  assert.equal(cart.subtotal, "100.00");
});
