// End-to-end checkout over HTTP with real login sessions and MySQL (SCRUM-34).
// Needs the dobby_test database. Run with: npm run test:db

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

process.env.NODE_ENV = "test";
const config = require("../config");
const { db } = require("../db/knex");
const { createApp } = require("../app");
const { KnexSessionStore } = require("../auth/sessionStore");
const { createMockBank, DECLINED_CARD } = require("../payment/mockBank");

// Same body shape as the frontend's submitCheckout (SCRUM-38)
const CARD = { cardholderName: "Checkout Tester", cardNumber: "4242 4242 4242 4242", expiryMonth: 12, expiryYear: 2099, cvc: "123" };
const HOME = "Orta Mah. Universite Cad. No:27, Tuzla";

let server;
let request;
let bank;
const hooks = {};
let chargeCalls = 0;
let emailCounter = 0;

const cookieOf = (res) => res.headers.get("set-cookie")?.split(";")[0] ?? null;
const newKey = () => crypto.randomUUID();
const stockOf = async (id) => (await db("products").where({ id }).first("quantity_in_stock")).quantity_in_stock;

async function newCustomer() {
  emailCounter += 1;
  const email = `checkout${emailCounter}@example.com`;
  await request("POST", "/auth/register", {
    body: { name: "Checkout Tester", taxId: "12345678901", email, homeAddress: HOME, password: "secret123" },
  });
  const res = await request("POST", "/auth/login", { body: { email, password: "secret123" } });
  assert.equal(res.status, 200);
  const cookie = cookieOf(res);
  const me = await (await request("GET", "/auth/me", { cookie })).json();
  return { cookie, id: me.user.id };
}

async function addToCart(cookie, productId, quantity) {
  const res = await request("POST", "/cart/items", { cookie, body: { productId, quantity } });
  assert.equal(res.status, 200);
  return (await res.json()).cart;
}

const checkout = (cookie, { key = newKey(), expectedTotal, card = CARD, deliveryAddress } = {}) =>
  request("POST", "/checkout", {
    cookie,
    body: { requestKey: key, expectedTotal, payment: card, ...(deliveryAddress ? { deliveryAddress } : {}) },
  });

before(async () => {
  await db.migrate.rollback(undefined, true);
  await db.migrate.latest();
  await db.seed.run();
  const realBank = createMockBank();
  bank = {
    charge: async (args) => {
      chargeCalls += 1;
      return realBank.charge(args);
    },
    void: (ref) => realBank.void(ref),
    capturedCount: () => realBank.capturedCount(),
  };
  const app = createApp({
    db,
    config,
    sessionStore: new KnexSessionStore({ db, cleanupIntervalMs: 0 }),
    bank,
    checkoutHooks: hooks,
  });
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://localhost:${server.address().port}`;
  request = (method, path, { body, cookie, headers = {} } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
});

beforeEach(async () => {
  delete hooks.afterStockUpdate;
  await db.seed.run(); // reset stock and prices to the seeded values
});

after(async () => {
  await new Promise((r) => server.close(r));
  await db.destroy();
});

test("guests cannot check out", async () => {
  const res = await checkout(null, { expectedTotal: "1.00" });
  assert.equal(res.status, 401);
});

test("empty cart is rejected and nothing is charged", async () => {
  const { cookie } = await newCustomer();
  const before = chargeCalls;
  const res = await checkout(cookie, { expectedTotal: "0.00" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, "EMPTY_CART");
  assert.equal(chargeCalls, before);
});

test("successful checkout creates one processing order, decrements stock once and clears the cart", async () => {
  const { cookie, id } = await newCustomer();
  const cart = await addToCart(cookie, 10, 2); // 2 x 18749.90
  assert.equal(cart.subtotal, "37499.80");
  const stockBefore = await stockOf(10);

  const res = await checkout(cookie, { expectedTotal: "37499.80" });
  assert.equal(res.status, 201);
  const { order } = await res.json();
  assert.equal(order.status, "processing");
  assert.equal(order.total, "37499.80");
  assert.equal(order.deliveryAddress, HOME); // falls back to the home address
  assert.deepEqual(order.items.map((i) => [i.productId, i.productName, i.quantity, i.unitPrice, i.lineTotal]), [
    [10, "10-Inch Ported Subwoofer", 2, "18749.90", "37499.80"],
  ]);
  assert.equal(order.paymentMode, "test");
  assert.equal(order.cardLast4, "4242");

  assert.equal(await stockOf(10), stockBefore - 2);
  assert.equal((await db("orders").where({ customer_id: id })).length, 1);
  const after = await (await request("GET", "/cart", { cookie })).json();
  assert.equal(after.cart.items.length, 0);
});

test("a sent delivery address is stored as the order's snapshot", async () => {
  const { cookie } = await newCustomer();
  await addToCart(cookie, 11, 1);
  const res = await checkout(cookie, { expectedTotal: "9990.00", deliveryAddress: "Kadikoy Rihtim Cad. No:1, Istanbul" });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).order.deliveryAddress, "Kadikoy Rihtim Cad. No:1, Istanbul");
});

test("full card number and CVV are never stored", async () => {
  const dump = JSON.stringify([
    await db("orders").select(),
    await db("checkout_requests").select(),
    await db("order_items").select(),
  ]);
  assert.ok(!dump.includes("4242424242424242"));
  assert.ok(!dump.includes("4242 4242 4242 4242"));
  assert.ok(!/"cvv"/i.test(dump));
});

test("tampered or outdated total returns review-required and charges nothing", async () => {
  const { cookie } = await newCustomer();
  await addToCart(cookie, 11, 1);
  const before = chargeCalls;
  const res = await checkout(cookie, { expectedTotal: "1.00" });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, "CART_CHANGED");
  assert.equal(body.error.cart.subtotal, "9990.00");
  assert.equal(chargeCalls, before);
  assert.equal(await stockOf(11), 15);
});

test("price change after the customer saw the cart requires review", async () => {
  const { cookie } = await newCustomer();
  const cart = await addToCart(cookie, 11, 1);
  await db("products").where({ id: 11 }).update({ price: "10990.00" });
  const res = await checkout(cookie, { expectedTotal: cart.subtotal });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error.cart.subtotal, "10990.00");
});

test("unavailable cart items stop checkout", async () => {
  const { cookie } = await newCustomer();
  await addToCart(cookie, 13, 1);
  await db("products").where({ id: 13 }).update({ quantity_in_stock: 0 });
  const res = await checkout(cookie, { expectedTotal: "37490.00" });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, "CART_CHANGED");
  assert.equal(body.error.cart.items[0].problem, "OUT_OF_STOCK");
});

test("declined test card: no order, cart and stock unchanged, retry with same key gives same answer", async () => {
  const { cookie, id } = await newCustomer();
  await addToCart(cookie, 11, 1);
  const key = newKey();
  const card = { ...CARD, cardNumber: DECLINED_CARD };

  const first = await checkout(cookie, { key, expectedTotal: "9990.00", card });
  assert.equal(first.status, 402);
  assert.equal((await first.json()).error.code, "PAYMENT_DECLINED");
  const calls = chargeCalls;

  const again = await checkout(cookie, { key, expectedTotal: "9990.00", card });
  assert.equal(again.status, 402);
  assert.equal(again.headers.get("Idempotent-Replayed"), "true");
  assert.equal(chargeCalls, calls, "a replay must not call the bank again");

  assert.equal((await db("orders").where({ customer_id: id })).length, 0);
  assert.equal(await stockOf(11), 15);
  const cart = await (await request("GET", "/cart", { cookie })).json();
  assert.equal(cart.cart.items.length, 1);
});

test("double submit with the same key: one charge, one order, same response", async () => {
  const { cookie, id } = await newCustomer();
  await addToCart(cookie, 9, 1);
  const key = newKey();
  const calls = chargeCalls;

  const first = await checkout(cookie, { key, expectedTotal: "24990.00" });
  const second = await checkout(cookie, { key, expectedTotal: "24990.00" });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(second.headers.get("Idempotent-Replayed"), "true");
  assert.deepEqual(await second.json(), await first.json());
  assert.equal(chargeCalls, calls + 1);
  assert.equal((await db("orders").where({ customer_id: id })).length, 1);
  assert.equal(await stockOf(9), 11);
});

test("two simultaneous submits with the same key create exactly one order", async () => {
  const { cookie, id } = await newCustomer();
  await addToCart(cookie, 9, 1);
  const key = newKey();
  const results = await Promise.all([
    checkout(cookie, { key, expectedTotal: "24990.00" }),
    checkout(cookie, { key, expectedTotal: "24990.00" }),
  ]);
  const statuses = results.map((r) => r.status).sort();
  assert.ok(statuses.includes(201));
  assert.ok(statuses.every((s) => s === 201 || s === 503), statuses.join(","));
  assert.equal((await db("orders").where({ customer_id: id })).length, 1);
  assert.equal(await stockOf(9), 11);
});

test("the same key with different input is rejected", async () => {
  const { cookie } = await newCustomer();
  await addToCart(cookie, 11, 1);
  const key = newKey();
  assert.equal((await checkout(cookie, { key, expectedTotal: "9990.00", card: { ...CARD, cardNumber: DECLINED_CARD } })).status, 402);
  const res = await checkout(cookie, { key, expectedTotal: "9990.00" });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).error.code, "REQUEST_KEY_REUSED");
});

test("a failure inside the transaction leaves no order and no stock change, and voids the charge", async () => {
  const { cookie, id } = await newCustomer();
  await addToCart(cookie, 13, 2);
  const captured = bank.capturedCount();
  hooks.afterStockUpdate = () => {
    throw new Error("simulated database failure");
  };
  const original = console.error;
  console.error = () => {};
  const key = newKey();
  let res;
  try {
    res = await checkout(cookie, { key, expectedTotal: "74980.00" });
  } finally {
    console.error = original;
  }
  assert.equal(res.status, 500);
  assert.equal(await stockOf(13), 9, "stock decrement must be rolled back");
  assert.equal((await db("orders").where({ customer_id: id })).length, 0);
  assert.equal(bank.capturedCount(), captured, "the charge must be voided");
  const cart = await (await request("GET", "/cart", { cookie })).json();
  assert.equal(cart.cart.items[0].quantity, 2);

  // Nothing was kept, so the same key may be retried and now succeeds
  delete hooks.afterStockUpdate;
  const retry = await checkout(cookie, { key, expectedTotal: "74980.00" });
  assert.equal(retry.status, 201);
  assert.equal(await stockOf(13), 7);
});

test("two customers competing for the last unit: exactly one wins, stock never goes negative", async () => {
  const a = await newCustomer();
  const b = await newCustomer();
  await addToCart(a.cookie, 8, 1); // product 8 has exactly one unit
  await addToCart(b.cookie, 8, 1);
  const captured = bank.capturedCount();

  const results = await Promise.all([
    checkout(a.cookie, { expectedTotal: "149900.00" }),
    checkout(b.cookie, { expectedTotal: "149900.00" }),
  ]);
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 409]);
  const loser = results.find((r) => r.status === 409);
  assert.equal((await loser.json()).error.code, "OUT_OF_STOCK");

  assert.equal(await stockOf(8), 0);
  assert.equal((await db("order_items").where({ product_id: 8 })).length, 1);
  assert.equal(bank.capturedCount(), captured + 1, "the loser's charge is voided");
});
