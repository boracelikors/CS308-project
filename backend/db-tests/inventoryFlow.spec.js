const { before, after, test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { resetTestDatabase, startTestApp, registerCustomer } = require("./support");
const { DEV_PRODUCT_MANAGER } = require("../db/seeds/02_dev_accounts");

let api, buyer, manager;

before(async () => {
  await resetTestDatabase();
  api = await startTestApp();
  buyer = (await registerCustomer(api, "inventory-buyer@example.test")).cookie;
  const session = await api.request("POST", "/auth/login", { body: DEV_PRODUCT_MANAGER });
  assert.equal(session.status, 200);
  manager = session.cookie;
});
after(async () => { await api?.close(); });

const product = (id) => api.request("GET", `/products/${id}`);
const patch = (id, cookie, quantity, expectedQuantity) =>
  api.request("PATCH", `/manager/products/${id}/stock`, { cookie, body: { quantity, expectedQuantity } });

test("only product managers can edit stock and quantities must fit the database column", async () => {
  const id = 10;
  const existing = (await product(id)).body.product.quantityInStock;
  assert.equal((await patch(id, undefined, 0, existing)).status, 401);
  assert.equal((await patch(id, buyer, 0, existing)).status, 403);
  for (const invalid of [-1, 0.5, "1", 2147483648, null]) {
    assert.equal((await patch(id, manager, invalid, existing)).status, 400);
  }
  assert.equal((await patch(id, manager, 0, undefined)).status, 400);
  assert.equal((await patch(999999, manager, 0, 1)).status, 404);
});

test("setting stock to zero is reflected in the catalogue and blocks adding the item", async () => {
  const id = 11;
  const before = (await product(id)).body.product.quantityInStock;
  assert.ok(before > 0);
  assert.equal((await patch(id, manager, 0, before)).status, 200);
  assert.equal((await product(id)).body.product.inStock, false);
  const cart = await api.request("POST", "/cart/items", { cookie: buyer, body: { productId: id, quantity: 1 } });
  assert.notEqual(cart.status, 200);
  assert.equal((await patch(id, manager, before, 0)).status, 200);
});

test("a stale stock edit cannot overwrite a stock reduction from checkout", async () => {
  const id = 8;
  const old = (await product(id)).body.product.quantityInStock;
  assert.ok(old > 0);
  const cart = await api.request("POST", "/cart/items", { cookie: buyer, body: { productId: id, quantity: 1 } });
  assert.equal(cart.status, 200);
  const order = await api.request("POST", "/checkout", {
    cookie: buyer,
    body: {
      requestKey: randomUUID(),
      expectedTotal: cart.body.cart.subtotal,
      payment: { cardholderName: "Inventory Demo", cardNumber: "4242424242424242", expiryMonth: 12, expiryYear: 2099, cvc: "123" },
    },
  });
  assert.equal(order.status, 201);
  const stale = await patch(id, manager, old + 9, old);
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, "STOCK_CHANGED");
  assert.equal(stale.body.error.currentQuantity, old - 1);
  assert.equal((await product(id)).body.product.quantityInStock, old - 1);
});

test("two manager edits against the same original amount cannot both succeed", async () => {
  const id = 12;
  const old = (await product(id)).body.product.quantityInStock;
  const results = await Promise.all([patch(id, manager, old + 1, old), patch(id, manager, old + 2, old)]);
  assert.deepEqual(results.map(({ status }) => status).sort(), [200, 409]);
});
