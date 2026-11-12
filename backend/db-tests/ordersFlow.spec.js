// End-to-end order tracking and delivery workflow over HTTP with MySQL (SCRUM-35).
// Needs the dobby_test database. Run with: npm run test:db

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

process.env.NODE_ENV = "test";
const config = require("../config");
const { db } = require("../db/knex");
const { createApp } = require("../app");
const { KnexSessionStore } = require("../auth/sessionStore");
const { DEV_PRODUCT_MANAGER } = require("../db/seeds/02_dev_accounts");

const PAYMENT = { cardholderName: "Order Tester", cardNumber: "4242424242424242", expiryMonth: 12, expiryYear: 2099, cvc: "123" };
const HOME = "Orta Mah. Universite Cad. No:27, Tuzla";

let server;
let request;
let alice;
let bob;
let manager;
let aliceOrderId;
let bobOrderId;

const cookieOf = (res) => res.headers.get("set-cookie")?.split(";")[0] ?? null;

async function startServer() {
  const app = createApp({ db, config, sessionStore: new KnexSessionStore({ db, cleanupIntervalMs: 0 }) });
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://localhost:${server.address().port}`;
  request = (method, path, { body, cookie } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
}

const stopServer = () => new Promise((r) => server.close(r));

async function login(email, password) {
  const res = await request("POST", "/auth/login", { body: { email, password } });
  assert.equal(res.status, 200, `login ${email}`);
  return cookieOf(res);
}

async function newCustomer(email) {
  await request("POST", "/auth/register", {
    body: { name: "Order Tester", taxId: "12345678901", email, homeAddress: HOME, password: "secret123" },
  });
  return login(email, "secret123");
}

async function buy(cookie, productId, quantity) {
  const add = await request("POST", "/cart/items", { cookie, body: { productId, quantity } });
  const { cart } = await add.json();
  const res = await request("POST", "/checkout", {
    cookie,
    body: { requestKey: crypto.randomUUID(), expectedTotal: cart.subtotal, payment: PAYMENT },
  });
  assert.equal(res.status, 201);
  return (await res.json()).order.id;
}

const setStatus = (cookie, id, status) => request("PATCH", `/orders/${id}/status`, { cookie, body: { status } });

before(async () => {
  await db.migrate.rollback(undefined, true);
  await db.migrate.latest();
  await db.seed.run();
  await startServer();
  alice = await newCustomer("alice.orders@example.com");
  bob = await newCustomer("bob.orders@example.com");
  manager = await login(DEV_PRODUCT_MANAGER.email, DEV_PRODUCT_MANAGER.password);
  aliceOrderId = await buy(alice, 10, 2);
  await buy(alice, 11, 1);
  bobOrderId = await buy(bob, 9, 1);
});

after(async () => {
  await stopServer();
  await db.destroy();
});

test("the development product manager seed can log in and has the right role", async () => {
  const me = await (await request("GET", "/auth/me", { cookie: manager })).json();
  assert.equal(me.user.role, "product_manager");
});

test("a customer with no orders gets an empty list", async () => {
  const cookie = await newCustomer("empty.orders@example.com");
  const res = await request("GET", "/orders", { cookie });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { orders: [] });
});

test("customers see only their own orders, newest first", async () => {
  const { orders } = await (await request("GET", "/orders", { cookie: alice })).json();
  assert.equal(orders.length, 2);
  assert.ok(orders[0].id > orders[1].id);
  assert.ok(orders.every((o) => o.id !== bobOrderId));
  assert.deepEqual(Object.keys(orders[0]).sort(), ["createdAt", "currency", "id", "status", "total"]);
});

test("order detail has item, price and address snapshots and the status", async () => {
  const res = await request("GET", `/orders/${aliceOrderId}`, { cookie: alice });
  assert.equal(res.status, 200);
  const { order } = await res.json();
  assert.equal(order.status, "processing");
  assert.equal(order.deliveryAddress, HOME);
  assert.equal(order.total, "37499.80");
  assert.deepEqual(order.items.map((i) => [i.productName, i.productModel, i.unitPrice, i.quantity]), [
    ["10-Inch Ported Subwoofer", "DB-SUB10P", "18749.90", 2],
  ]);
  assert.equal(order.inTransitAt, null);
  assert.equal(order.deliveredAt, null);
});

test("another customer's order ID looks exactly like a missing order", async () => {
  const other = await request("GET", `/orders/${bobOrderId}`, { cookie: alice });
  const missing = await request("GET", "/orders/999999", { cookie: alice });
  assert.equal(other.status, 404);
  assert.equal(missing.status, 404);
  assert.deepEqual(await other.json(), await missing.json());
});

test("customers and guests cannot see deliveries or change status", async () => {
  assert.equal((await request("GET", "/deliveries")).status, 401);
  assert.equal((await request("GET", "/deliveries", { cookie: alice })).status, 403);
  assert.equal((await setStatus(null, aliceOrderId, "in_transit")).status, 401);
  // A customer cannot mark their own order delivered
  assert.equal((await setStatus(alice, aliceOrderId, "in_transit")).status, 403);
  assert.equal((await setStatus(alice, aliceOrderId, "delivered")).status, 403);
  const { order } = await (await request("GET", `/orders/${aliceOrderId}`, { cookie: alice })).json();
  assert.equal(order.status, "processing");
});

test("delivery list has the R12 fields and no unnecessary personal data", async () => {
  const res = await request("GET", "/deliveries", { cookie: manager });
  assert.equal(res.status, 200);
  const { deliveries } = await res.json();
  assert.equal(deliveries.length, 3);
  const row = deliveries.find((d) => d.orderId === aliceOrderId);
  for (const field of ["deliveryId", "orderId", "customerId", "productId", "quantity", "totalPrice", "deliveryAddress", "completed"]) {
    assert.ok(field in row, `missing ${field}`);
  }
  assert.equal(row.totalPrice, "37499.80");
  assert.equal(row.completed, false);
  const text = JSON.stringify(deliveries);
  for (const secret of ["alice.orders@example.com", "12345678901", "password", "4242424242424242"]) {
    assert.ok(!text.includes(secret), `delivery list must not contain ${secret}`);
  }
});

test("status skipping is rejected", async () => {
  const res = await setStatus(manager, aliceOrderId, "delivered");
  assert.equal(res.status, 409);
  const { error } = await res.json();
  assert.equal(error.code, "INVALID_STATUS_TRANSITION");
  assert.equal(error.currentStatus, "processing");
});

test("a product manager advances processing -> in_transit -> delivered with timestamps", async () => {
  let res = await setStatus(manager, aliceOrderId, "in_transit");
  assert.equal(res.status, 200);
  let { order } = await res.json();
  assert.equal(order.status, "in_transit");
  assert.ok(order.inTransitAt);
  assert.equal(order.deliveredAt, null);

  res = await setStatus(manager, aliceOrderId, "delivered");
  ({ order } = await res.json());
  assert.equal(order.status, "delivered");
  assert.ok(order.deliveredAt);

  // The customer sees the new status
  const mine = await (await request("GET", `/orders/${aliceOrderId}`, { cookie: alice })).json();
  assert.equal(mine.order.status, "delivered");

  const filtered = await (await request("GET", "/deliveries?status=delivered", { cookie: manager })).json();
  assert.deepEqual(filtered.deliveries.map((d) => [d.orderId, d.completed]), [[aliceOrderId, true]]);
});

test("reversal and repeating a step are rejected", async () => {
  const back = await setStatus(manager, aliceOrderId, "in_transit");
  assert.equal(back.status, 409);
  const again = await setStatus(manager, aliceOrderId, "delivered");
  assert.equal(again.status, 409);
  assert.equal((await setStatus(manager, 999999, "in_transit")).status, 404);
});

test("two managers advancing the same order at once apply the step only once", async () => {
  const results = await Promise.all([
    setStatus(manager, bobOrderId, "in_transit"),
    setStatus(manager, bobOrderId, "in_transit"),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
});

test("orders, statuses and login sessions survive a server restart", async () => {
  await stopServer();
  await startServer();
  const { order } = await (await request("GET", `/orders/${aliceOrderId}`, { cookie: alice })).json();
  assert.equal(order.status, "delivered");
  assert.ok(order.deliveredAt);
  const bobs = await (await request("GET", "/orders", { cookie: bob })).json();
  assert.equal(bobs.orders[0].status, "in_transit");
});
