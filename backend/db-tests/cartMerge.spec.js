// POST /cart/merge against real MySQL, the demo catalogue and real login sessions (SCRUM-32).
// Needs the dobby_test database. Run with: npm run test:db
//
// Demo products used (db/seeds/01_catalog.js):
//   1  89900.00, stock 4      7  stock 0      8  149900.00, stock 1 (last item)
//   10 18749.90 (fractional), stock 7         11 9990.00, stock 15

const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

process.env.NODE_ENV = "test";
const config = require("../config");
const { db } = require("../db/knex");
const { createApp } = require("../app");
const { KnexSessionStore } = require("../auth/sessionStore");

let server;
let base;
let alice;
let bob;

const cookieOf = (res) => res.headers.get("set-cookie")?.split(";")[0] ?? null;

async function call(method, path, { body, cookie } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, res };
}

async function customer(email) {
  await call("POST", "/auth/register", {
    body: {
      name: "Merge Tester",
      taxId: "12345678901",
      email,
      homeAddress: "Orta Mah. Universite Cad. No:27, Tuzla",
      password: "secret123",
    },
  });
  const login = await call("POST", "/auth/login", { body: { email, password: "secret123" } });
  return { cookie: cookieOf(login.res), id: login.body.user.id };
}

const newKey = () => crypto.randomUUID();
const merge = (who, items, requestKey = newKey()) =>
  call("POST", "/cart/merge", { cookie: who.cookie, body: { requestKey, items } });
const quantities = (cart) => Object.fromEntries(cart.items.map((i) => [i.productId, i.quantity]));

before(async () => {
  await db.migrate.rollback(undefined, true);
  await db.migrate.latest();
  await db.seed.run();
  const app = createApp({ db, config, sessionStore: new KnexSessionStore({ db, cleanupIntervalMs: 0 }) });
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://localhost:${server.address().port}`;
  alice = await customer("alice.merge@example.com");
  bob = await customer("bob.merge@example.com");
});

// Every test starts with empty carts, no recorded keys and the original catalogue
beforeEach(async () => {
  await db("cart_items").del();
  await db("cart_merge_requests").del();
  await db.seed.run();
  await db("products").update({ is_active: true });
});

after(async () => {
  await new Promise((r) => server.close(r));
  await db.destroy();
});

test("guests cannot merge", async () => {
  const res = await call("POST", "/cart/merge", { body: { requestKey: newKey(), items: [{ productId: 1, quantity: 1 }] } });
  assert.equal(res.status, 401);
});

test("distinct guest products are added to an empty account cart", async () => {
  const { status, body } = await merge(alice, [{ productId: 1, quantity: 1 }, { productId: 11, quantity: 2 }]);
  assert.equal(status, 200);
  assert.deepEqual(quantities(body.cart), { 1: 1, 11: 2 });
  assert.deepEqual(body.adjustments, []);
  assert.equal(body.replayed, false);
  // The cart is stored: reading it again gives the same lines
  assert.deepEqual(quantities((await call("GET", "/cart", { cookie: alice.cookie })).body.cart), { 1: 1, 11: 2 });
});

test("overlapping products add up with the account cart; other account lines stay", async () => {
  await call("POST", "/cart/items", { cookie: alice.cookie, body: { productId: 11, quantity: 2 } });
  await call("POST", "/cart/items", { cookie: alice.cookie, body: { productId: 10, quantity: 1 } });
  const { body } = await merge(alice, [{ productId: 11, quantity: 3 }, { productId: 1, quantity: 1 }]);
  assert.deepEqual(quantities(body.cart), { 11: 5, 10: 1, 1: 1 });
  assert.deepEqual(body.adjustments, []);
});

test("limited stock caps the total and reports it", async () => {
  await call("POST", "/cart/items", { cookie: alice.cookie, body: { productId: 1, quantity: 2 } });
  const { body } = await merge(alice, [{ productId: 1, quantity: 5 }, { productId: 8, quantity: 2 }]);
  assert.deepEqual(quantities(body.cart), { 1: 4, 8: 1 });
  assert.deepEqual(body.adjustments, [
    { productId: 1, name: "Reference Bookshelf Monitors (Pair)", requested: 7, applied: 4, reason: "INSUFFICIENT_STOCK" },
    { productId: 8, name: "Three-Way Floorstanding Towers (Pair)", requested: 2, applied: 1, reason: "INSUFFICIENT_STOCK" },
  ]);
});

test("zero-stock, off-sale and unknown products are not added; the rest is", async () => {
  await db("products").where({ id: 10 }).update({ is_active: false });
  const { status, body } = await merge(alice, [
    { productId: 7, quantity: 1 },
    { productId: 10, quantity: 1 },
    { productId: 99999, quantity: 1 },
    { productId: 11, quantity: 1 },
  ]);
  assert.equal(status, 200);
  assert.deepEqual(quantities(body.cart), { 11: 1 });
  assert.deepEqual(
    body.adjustments.map((a) => [a.productId, a.reason, a.applied]),
    [[7, "OUT_OF_STOCK", 0], [10, "PRODUCT_UNAVAILABLE", 0], [99999, "PRODUCT_UNAVAILABLE", 0]]
  );
});

test("prices and totals come from the database; client totals are ignored", async () => {
  const { body } = await call("POST", "/cart/merge", {
    cookie: alice.cookie,
    body: { requestKey: newKey(), subtotal: "1.00", items: [{ productId: 10, quantity: 2, unitPrice: "0.01" }] },
  });
  assert.equal(body.cart.items[0].unitPrice, "18749.90");
  assert.equal(body.cart.subtotal, "37499.80");
});

test("malformed input is 400 and changes nothing", async () => {
  for (const bad of [
    { requestKey: "short", items: [{ productId: 1, quantity: 1 }] },
    { requestKey: newKey(), items: [] },
    { requestKey: newKey(), items: [{ productId: 1, quantity: 0 }] },
    { requestKey: newKey(), items: [{ productId: "1", quantity: 1 }] },
  ]) {
    const res = await call("POST", "/cart/merge", { cookie: alice.cookie, body: bad });
    assert.equal(res.status, 400, JSON.stringify(bad));
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  }
  assert.equal((await db("cart_merge_requests").count({ n: "*" }).first()).n, 0);
  assert.deepEqual((await call("GET", "/cart", { cookie: alice.cookie })).body.cart.items, []);
});

test("retrying the same key does not add quantities twice and returns the first adjustments", async () => {
  const key = newKey();
  const items = [{ productId: 1, quantity: 6 }, { productId: 11, quantity: 2 }];
  const first = await merge(alice, items, key);
  const second = await merge(alice, [...items].reverse(), key); // same items, other order

  assert.equal(second.status, 200);
  assert.equal(second.body.replayed, true);
  assert.deepEqual(quantities(second.body.cart), { 1: 4, 11: 2 });
  assert.deepEqual(second.body.adjustments, first.body.adjustments);
  assert.equal(first.body.adjustments[0].reason, "INSUFFICIENT_STOCK");
});

test("a replay shows the cart as it is now, not as it was", async () => {
  const key = newKey();
  await merge(alice, [{ productId: 11, quantity: 2 }], key);
  await call("PUT", "/cart/items/11", { cookie: alice.cookie, body: { quantity: 5 } });
  const replay = await merge(alice, [{ productId: 11, quantity: 2 }], key);
  assert.deepEqual(quantities(replay.body.cart), { 11: 5 });
});

test("the same key with different items is 422 and changes nothing", async () => {
  const key = newKey();
  await merge(alice, [{ productId: 11, quantity: 1 }], key);
  const res = await merge(alice, [{ productId: 11, quantity: 3 }], key);
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, "REQUEST_KEY_REUSED");
  assert.deepEqual(quantities((await call("GET", "/cart", { cookie: alice.cookie })).body.cart), { 11: 1 });
});

test("five simultaneous retries with one key are applied exactly once", async () => {
  const key = newKey();
  const items = [{ productId: 11, quantity: 2 }, { productId: 10, quantity: 1 }];
  const results = await Promise.all(Array.from({ length: 5 }, () => merge(alice, items, key)));

  assert.ok(results.every((r) => r.status === 200), JSON.stringify(results.map((r) => r.status)));
  assert.equal(results.filter((r) => !r.body.replayed).length, 1);
  assert.deepEqual(quantities((await call("GET", "/cart", { cookie: alice.cookie })).body.cart), { 11: 2, 10: 1 });
  const keys = await db("cart_merge_requests").where({ user_id: alice.id }).count({ n: "*" }).first();
  assert.equal(Number(keys.n), 1);
});

test("different keys are separate merges and do add up", async () => {
  await merge(alice, [{ productId: 11, quantity: 1 }]);
  await merge(alice, [{ productId: 11, quantity: 1 }]);
  assert.deepEqual(quantities((await call("GET", "/cart", { cookie: alice.cookie })).body.cart), { 11: 2 });
});

test("accounts are isolated: the same key for two customers merges into each own cart", async () => {
  const key = newKey();
  await merge(alice, [{ productId: 11, quantity: 1 }], key);
  const res = await merge(bob, [{ productId: 1, quantity: 2 }], key);
  assert.equal(res.status, 200);
  assert.equal(res.body.replayed, false);
  assert.deepEqual(quantities((await call("GET", "/cart", { cookie: alice.cookie })).body.cart), { 11: 1 });
  assert.deepEqual(quantities((await call("GET", "/cart", { cookie: bob.cookie })).body.cart), { 1: 2 });
});

test("merging never changes product stock", async () => {
  await merge(alice, [{ productId: 1, quantity: 2 }]);
  assert.equal((await db("products").where({ id: 1 }).first("quantity_in_stock")).quantity_in_stock, 4);
});