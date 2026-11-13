// HTTP tests for POST /checkout with a fake service and a fake session (no database needed)
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createCheckoutRouter } = require("../checkout/checkoutRoutes");
const { errorHandler } = require("../http/errorHandler");

// The "X-Test-User" header stands in for a real login: "7:customer"
function fakeSession(req, res, next) {
  const header = req.get("X-Test-User");
  if (header) {
    const [id, role] = header.split(":");
    req.session = { user: { id: Number(id), role } };
  }
  next();
}

async function startApp(t, service) {
  const calls = [];
  const recording = {
    checkout: async (db, bank, args) => {
      calls.push(args);
      return service(args);
    },
  };
  const app = express();
  app.use(express.json());
  app.use(fakeSession);
  app.use("/checkout", createCheckoutRouter({ db: null, bank: null, service: recording }));
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://localhost:${server.address().port}`;
  const request = ({ body, user = "7:customer" } = {}) =>
    fetch(`${base}/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(user ? { "X-Test-User": user } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
  return { request, calls };
}

const validBody = {
  requestKey: "key-12345678",
  expectedTotal: "100.00",
  deliveryAddress: "Orta Mah. Universite Cad. No:27, Tuzla",
  payment: { cardholderName: "Test Customer", cardNumber: "4242424242424242", expiryMonth: 12, expiryYear: 2099, cvc: "123" },
};
const created = async () => ({ status: 201, body: { order: { id: 1 } } });

test("guests get 401 and staff accounts get 403", async (t) => {
  const { request, calls } = await startApp(t, created);
  assert.equal((await request({ body: validBody, user: null })).status, 401);
  assert.equal((await request({ body: validBody, user: "3:product_manager" })).status, 403);
  assert.equal(calls.length, 0);
});

test("missing requestKey is rejected before anything runs", async (t) => {
  const { request, calls } = await startApp(t, created);
  const res = await request({ body: { ...validBody, requestKey: undefined } });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).error.fields.requestKey);
  assert.equal(calls.length, 0);
});

test("invalid card fields give 400 with field messages", async (t) => {
  const { request, calls } = await startApp(t, created);
  const res = await request({ body: { ...validBody, payment: { ...validBody.payment, cvc: "1" } } });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).error.fields.cvc);
  assert.equal(calls.length, 0);
});

test("the buyer comes from the session, never from the body", async (t) => {
  const { request, calls } = await startApp(t, created);
  const res = await request({ body: { ...validBody, userId: 99, customerId: 99 } });
  assert.equal(res.status, 201);
  assert.equal(calls[0].userId, 7);
  assert.equal(calls[0].key, "key-12345678");
});

test("a replayed result is marked with a header", async (t) => {
  const { request } = await startApp(t, async () => ({ status: 201, body: { order: { id: 1 } }, replayed: true }));
  const res = await request({ body: validBody });
  assert.equal(res.headers.get("Idempotent-Replayed"), "true");
});

test("unexpected errors become 500 without card data in the response", async (t) => {
  const { request } = await startApp(t, async () => {
    throw new Error("boom 4242424242424242");
  });
  const original = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args.map(String).join(" "));
  t.after(() => {
    console.error = original;
  });
  const res = await request({ body: validBody });
  const text = await res.text();
  assert.equal(res.status, 500);
  assert.ok(!text.includes("4242424242424242"));
  assert.ok(!logged.join(" ").includes("4242424242424242"), "card number must never be logged");
});
