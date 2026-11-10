// HTTP tests for the cart routes with a fake store and a fake session (no database needed)
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createCartRouter, parseProductId } = require("../cart/cartRoutes");
const { CartError } = require("../cart/cartStore");
const { errorHandler } = require("../http/errorHandler");

const EMPTY = { items: [], subtotal: "0.00", currency: null };

// The "X-Test-User" header stands in for a real login: "7:customer"
function fakeSession(req, res, next) {
  const header = req.get("X-Test-User");
  if (header) {
    const [id, role] = header.split(":");
    req.session = { user: { id: Number(id), role } };
  }
  next();
}

async function startApp(t, store) {
  const calls = [];
  const recording = {};
  for (const [name, fn] of Object.entries(store)) {
    recording[name] = async (...args) => {
      calls.push([name, ...args]);
      return fn(...args);
    };
  }
  const app = express();
  app.use(express.json());
  app.use(fakeSession);
  app.use("/cart", createCartRouter({ store: recording }));
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://localhost:${server.address().port}`;
  const request = (method, path, { body, user = "7:customer" } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(user ? { "X-Test-User": user } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  return { request, calls };
}

const okStore = {
  getCart: async () => EMPTY,
  addItem: async () => EMPTY,
  setItemQuantity: async () => EMPTY,
  removeItem: async () => EMPTY,
};

test("parseProductId accepts positive whole numbers only", () => {
  assert.equal(parseProductId(3), 3);
  assert.equal(parseProductId("12"), 12);
  for (const bad of [0, -1, 1.5, "abc", "03", "1e3", null, undefined, "99999999999"]) {
    assert.equal(parseProductId(bad), null, String(bad));
  }
});

test("guests get 401, staff get 403", async (t) => {
  const { request, calls } = await startApp(t, okStore);
  assert.equal((await request("GET", "/cart", { user: null })).status, 401);
  assert.equal((await request("GET", "/cart", { user: "2:product_manager" })).status, 403);
  assert.equal(calls.length, 0);
});

test("GET /cart uses the user from the session", async (t) => {
  const { request, calls } = await startApp(t, okStore);
  const res = await request("GET", "/cart");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { cart: EMPTY });
  assert.deepEqual(calls, [["getCart", 7]]);
});

test("a userId in the body is ignored; the session decides whose cart it is", async (t) => {
  const { request, calls } = await startApp(t, okStore);
  await request("POST", "/cart/items", { body: { productId: 3, quantity: 1, userId: 99 } });
  assert.deepEqual(calls, [["addItem", 7, 3, 1]]);
});

test("POST /cart/items with a bad productId is 400 VALIDATION_ERROR", async (t) => {
  const { request, calls } = await startApp(t, okStore);
  const res = await request("POST", "/cart/items", { body: { productId: "abc", quantity: 1 } });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "VALIDATION_ERROR");
  assert.ok(body.error.fields.productId);
  assert.equal(calls.length, 0);
});

test("cart errors map to the statuses in the API draft", async (t) => {
  const cases = [
    [new CartError("INVALID_QUANTITY", "bad"), 400],
    [new CartError("PRODUCT_NOT_FOUND", "none"), 404],
    [new CartError("CART_ITEM_NOT_FOUND", "none"), 404],
    [new CartError("OUT_OF_STOCK", "none left"), 409],
    [new CartError("INSUFFICIENT_STOCK", "Only 5 left in stock.", { available: 5 }), 409],
  ];
  for (const [err, status] of cases) {
    const { request } = await startApp(t, { ...okStore, addItem: async () => { throw err; } });
    const res = await request("POST", "/cart/items", { body: { productId: 3, quantity: 1 } });
    assert.equal(res.status, status, err.code);
    const body = await res.json();
    assert.equal(body.error.code, err.code);
    if (err.code === "INSUFFICIENT_STOCK") assert.equal(body.error.available, 5);
  }
});

test("PUT and DELETE pass the product ID from the URL", async (t) => {
  const { request, calls } = await startApp(t, okStore);
  assert.equal((await request("PUT", "/cart/items/4", { body: { quantity: 2 } })).status, 200);
  assert.equal((await request("DELETE", "/cart/items/4")).status, 200);
  assert.deepEqual(calls, [["setItemQuantity", 7, 4, 2], ["removeItem", 7, 4]]);
});

test("PUT with a non-numeric product ID is 404 CART_ITEM_NOT_FOUND", async (t) => {
  const { request } = await startApp(t, okStore);
  const res = await request("PUT", "/cart/items/abc", { body: { quantity: 2 } });
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, "CART_ITEM_NOT_FOUND");
});

test("unexpected store errors become 500 without details", async (t) => {
  const { request } = await startApp(t, {
    ...okStore,
    getCart: async () => { throw new Error("ECONNREFUSED secret"); },
  });
  const original = console.error;
  console.error = () => {};
  t.after(() => (console.error = original));
  const res = await request("GET", "/cart");
  assert.equal(res.status, 500);
  assert.doesNotMatch(await res.text(), /ECONNREFUSED|secret/);
});
