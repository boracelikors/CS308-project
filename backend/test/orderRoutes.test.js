// HTTP tests for order tracking and the delivery workflow with a fake store and session (SCRUM-35)
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createOrderRouter, createDeliveryRouter, parseOrderId } = require("../orders/orderRoutes");
const { OrderError, canMoveTo } = require("../orders/orderStore");
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

const ORDER = { id: 5, status: "processing", items: [] };

async function startApp(t, overrides = {}) {
  const calls = [];
  const store = {
    listCustomerOrders: async () => [],
    getCustomerOrder: async () => ORDER,
    listDeliveries: async () => [],
    advanceStatus: async () => ({ ...ORDER, status: "in_transit" }),
    ...overrides,
  };
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
  app.use("/orders", createOrderRouter({ store: recording }));
  app.use("/deliveries", createDeliveryRouter({ store: recording }));
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

test("parseOrderId accepts positive whole numbers only", () => {
  assert.equal(parseOrderId("12"), 12);
  for (const bad of ["0", "-1", "1.5", "abc", "", undefined, "12345678901"]) {
    assert.equal(parseOrderId(bad), null, String(bad));
  }
});

test("status moves only one step forward", () => {
  assert.equal(canMoveTo("processing", "in_transit"), true);
  assert.equal(canMoveTo("in_transit", "delivered"), true);
  assert.equal(canMoveTo("processing", "delivered"), false); // no skipping
  assert.equal(canMoveTo("delivered", "in_transit"), false); // no reversal
  assert.equal(canMoveTo("in_transit", "processing"), false);
  assert.equal(canMoveTo("delivered", "delivered"), false);
});

test("customer order routes: guests 401, staff 403", async (t) => {
  const { request, calls } = await startApp(t);
  assert.equal((await request("GET", "/orders", { user: null })).status, 401);
  assert.equal((await request("GET", "/orders", { user: "3:product_manager" })).status, 403);
  assert.equal((await request("GET", "/orders/5", { user: null })).status, 401);
  assert.equal(calls.length, 0);
});

test("an empty order list is a stable 200", async (t) => {
  const { request } = await startApp(t);
  const res = await request("GET", "/orders");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { orders: [] });
});

test("the customer ID always comes from the session", async (t) => {
  const { request, calls } = await startApp(t);
  await request("GET", "/orders?customerId=99");
  await request("GET", "/orders/5?customerId=99");
  assert.deepEqual(calls, [["listCustomerOrders", 7], ["getCustomerOrder", 7, 5]]);
});

test("invalid or unknown order IDs are 404 ORDER_NOT_FOUND", async (t) => {
  const { request, calls } = await startApp(t, {
    getCustomerOrder: async () => {
      throw new OrderError("ORDER_NOT_FOUND", "Order not found.");
    },
  });
  for (const path of ["/orders/abc", "/orders/0", "/orders/42"]) {
    const res = await request("GET", path);
    assert.equal(res.status, 404, path);
    assert.equal((await res.json()).error.code, "ORDER_NOT_FOUND");
  }
  assert.equal(calls.length, 1); // only the well-formed ID reached the store
});

test("status changes are product-manager only", async (t) => {
  const { request, calls } = await startApp(t);
  assert.equal((await request("PATCH", "/orders/5/status", { user: null, body: { status: "in_transit" } })).status, 401);
  assert.equal((await request("PATCH", "/orders/5/status", { body: { status: "delivered" } })).status, 403);
  assert.equal((await request("PATCH", "/orders/5/status", { user: "4:sales_manager", body: { status: "delivered" } })).status, 403);
  assert.equal(calls.length, 0);

  const ok = await request("PATCH", "/orders/5/status", { user: "3:product_manager", body: { status: "in_transit" } });
  assert.equal(ok.status, 200);
  assert.deepEqual(calls, [["advanceStatus", 5, "in_transit"]]);
});

test("unknown target status is a validation error", async (t) => {
  const { request, calls } = await startApp(t);
  for (const status of ["processing", "shipped", undefined]) {
    const res = await request("PATCH", "/orders/5/status", { user: "3:product_manager", body: { status } });
    assert.equal(res.status, 400, String(status));
  }
  assert.equal(calls.length, 0);
});

test("unsupported transitions are 409 with the current status", async (t) => {
  const { request } = await startApp(t, {
    advanceStatus: async () => {
      throw new OrderError("INVALID_STATUS_TRANSITION", "nope", { currentStatus: "delivered" });
    },
  });
  const res = await request("PATCH", "/orders/5/status", { user: "3:product_manager", body: { status: "in_transit" } });
  assert.equal(res.status, 409);
  const { error } = await res.json();
  assert.equal(error.code, "INVALID_STATUS_TRANSITION");
  assert.equal(error.currentStatus, "delivered");
});

test("delivery list: product managers only, optional status filter is validated", async (t) => {
  const { request, calls } = await startApp(t);
  assert.equal((await request("GET", "/deliveries", { user: null })).status, 401);
  assert.equal((await request("GET", "/deliveries")).status, 403);
  assert.equal((await request("GET", "/deliveries?status=lost", { user: "3:product_manager" })).status, 400);
  const res = await request("GET", "/deliveries?status=processing", { user: "3:product_manager" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { deliveries: [] });
  assert.deepEqual(calls, [["listDeliveries", { status: "processing" }]]);
});
