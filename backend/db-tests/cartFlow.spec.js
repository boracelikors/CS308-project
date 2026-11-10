// End-to-end cart over HTTP with real login sessions and MySQL (SCRUM-28).
// Needs the dobby_test database. Run with: npm run test:db

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
const config = require("../config");
const { db } = require("../db/knex");
const { createApp } = require("../app");
const { KnexSessionStore } = require("../auth/sessionStore");
const { hashPassword } = require("../auth/password");

let server;
let request;

const cookieOf = (res) => res.headers.get("set-cookie")?.split(";")[0] ?? null;

function account(email) {
  return {
    name: "Cart Tester",
    taxId: "12345678901",
    email,
    homeAddress: "Orta Mah. Universite Cad. No:27, Tuzla",
    password: "secret123",
  };
}

async function registerAndLogin(email) {
  await request("POST", "/auth/register", { body: account(email) });
  const res = await request("POST", "/auth/login", { body: { email, password: "secret123" } });
  assert.equal(res.status, 200);
  return cookieOf(res);
}

before(async () => {
  await db.migrate.rollback(undefined, true);
  await db.migrate.latest();
  await db.seed.run();
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
});

after(async () => {
  await new Promise((r) => server.close(r));
  await db.destroy();
});

test("guests cannot use the cart", async () => {
  const res = await request("GET", "/cart");
  assert.equal(res.status, 401);
});

test("add, read, change and remove items as a logged-in customer", async () => {
  const cookie = await registerAndLogin("flow@example.com");

  let res = await request("POST", "/cart/items", { cookie, body: { productId: 10, quantity: 2 } });
  assert.equal(res.status, 200);
  let { cart } = await res.json();
  assert.equal(cart.items[0].lineTotal, "37499.80");
  assert.equal(cart.subtotal, "37499.80");

  res = await request("PUT", "/cart/items/10", { cookie, body: { quantity: 3 } });
  ({ cart } = await res.json());
  assert.equal(cart.items[0].quantity, 3);

  res = await request("GET", "/cart", { cookie });
  ({ cart } = await res.json());
  assert.equal(cart.subtotal, "56249.70");

  res = await request("DELETE", "/cart/items/10", { cookie });
  ({ cart } = await res.json());
  assert.deepEqual(cart, { items: [], subtotal: "0.00", currency: null });
});

test("stock errors come back with the right status and code", async () => {
  const cookie = await registerAndLogin("stock@example.com");
  let res = await request("POST", "/cart/items", { cookie, body: { productId: 7, quantity: 1 } });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error.code, "OUT_OF_STOCK");

  res = await request("POST", "/cart/items", { cookie, body: { productId: 8, quantity: 2 } });
  assert.equal(res.status, 409);
  assert.deepEqual((await res.json()).error, {
    code: "INSUFFICIENT_STOCK",
    message: "Only 1 left in stock.",
    available: 1,
  });

  res = await request("POST", "/cart/items", { cookie, body: { productId: 9999, quantity: 1 } });
  assert.equal(res.status, 404);
});

test("the cart is kept after logout and login again", async () => {
  const email = "persist@example.com";
  let cookie = await registerAndLogin(email);
  await request("POST", "/cart/items", { cookie, body: { productId: 11, quantity: 2 } });
  await request("POST", "/auth/logout", { cookie });
  assert.equal((await request("GET", "/cart", { cookie })).status, 401);

  const res = await request("POST", "/auth/login", { body: { email, password: "secret123" } });
  cookie = cookieOf(res);
  const { cart } = await (await request("GET", "/cart", { cookie })).json();
  assert.equal(cart.items[0].productId, 11);
  assert.equal(cart.items[0].quantity, 2);
});

test("customers only see their own cart", async () => {
  const alice = await registerAndLogin("alice-flow@example.com");
  const bob = await registerAndLogin("bob-flow@example.com");
  await request("POST", "/cart/items", { cookie: alice, body: { productId: 11, quantity: 1 } });
  const { cart } = await (await request("GET", "/cart", { cookie: bob })).json();
  assert.equal(cart.items.length, 0);
});

test("staff accounts get 403 from the cart", async () => {
  await db("users").insert({
    name: "Product Manager",
    email: "pm@example.com",
    password_hash: await hashPassword("secret123"),
    role: "product_manager",
  });
  const res = await request("POST", "/auth/login", { body: { email: "pm@example.com", password: "secret123" } });
  const cookie = cookieOf(res);
  assert.equal((await request("GET", "/cart", { cookie })).status, 403);
});
