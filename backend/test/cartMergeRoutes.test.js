// HTTP tests for POST /cart/merge with a fake store and a fake session (no database needed)
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createCartRouter } = require("../cart/cartRoutes");
const { MergeKeyReused } = require("../cart/cartMerge");
const { requestHash } = require("../cart/validateMerge");
const { errorHandler } = require("../http/errorHandler");

const KEY = "3f1c2a9e-8b7d-4c6e-9f00-1a2b3c4d5e6f";
const CART = { items: [], subtotal: "0.00", currency: null };
const RESULT = { cart: CART, adjustments: [], replayed: false };

// The "X-Test-User" header stands in for a real login: "7:customer"
function fakeSession(req, res, next) {
  const header = req.get("X-Test-User");
  if (header) {
    const [id, role] = header.split(":");
    req.session = { user: { id: Number(id), role } };
  }
  next();
}

async function startApp(t, mergeGuestCart) {
  const calls = [];
  const store = {
    mergeGuestCart: async (...args) => {
      calls.push(args);
      return mergeGuestCart(...args);
    },
  };
  const app = express();
  app.use(express.json());
  app.use(fakeSession);
  app.use("/cart", createCartRouter({ store }));
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://localhost:${server.address().port}`;
  const post = (body, user = "7:customer") =>
    fetch(`${base}/cart/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(user ? { "X-Test-User": user } : {}) },
      body: JSON.stringify(body),
    });
  return { post, calls };
}

const body = { requestKey: KEY, items: [{ productId: 3, quantity: 1 }, { productId: 1, quantity: 2 }] };

test("guests get 401 and staff get 403 without reaching the store", async (t) => {
  const { post, calls } = await startApp(t, async () => RESULT);
  assert.equal((await post(body, null)).status, 401);
  assert.equal((await post(body, "2:sales_manager")).status, 403);
  assert.equal(calls.length, 0);
});

test("the session user is merged with normalized items and their hash", async (t) => {
  const { post, calls } = await startApp(t, async () => RESULT);
  const res = await post({ ...body, userId: 99 }); // a userId in the body is ignored
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), RESULT);
  const items = [{ productId: 1, quantity: 2 }, { productId: 3, quantity: 1 }];
  assert.deepEqual(calls, [[7, { requestKey: KEY, items, hash: requestHash(items) }]]);
});

test("invalid input is 400 VALIDATION_ERROR and nothing is merged", async (t) => {
  const { post, calls } = await startApp(t, async () => RESULT);
  const res = await post({ requestKey: "x", items: [{ productId: 1, quantity: 0 }] });
  assert.equal(res.status, 400);
  const { error } = await res.json();
  assert.equal(error.code, "VALIDATION_ERROR");
  assert.ok(error.fields.requestKey);
  assert.ok(error.fields.items);
  assert.equal(calls.length, 0);
});

test("a reused key with different items is 422 REQUEST_KEY_REUSED", async (t) => {
  const { post } = await startApp(t, async () => {
    throw new MergeKeyReused();
  });
  const res = await post(body);
  assert.equal(res.status, 422);
  assert.equal((await res.json()).error.code, "REQUEST_KEY_REUSED");
});

test("unexpected errors become 500 without details", async (t) => {
  const { post } = await startApp(t, async () => {
    throw new Error("Deadlock found when trying to get lock");
  });
  const original = console.error;
  console.error = () => {};
  t.after(() => {
    console.error = original;
  });
  const res = await post(body);
  assert.equal(res.status, 500);
  assert.equal(JSON.stringify(await res.json()).includes("Deadlock"), false);
});