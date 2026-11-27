// HTTP tests for the invoice endpoints with a fake store and a fake session (no database)
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createInvoiceRouter } = require("../invoices/invoiceRoutes");
const { errorHandler } = require("../http/errorHandler");

const INVOICE = { number: "INV-2026-000005", orderId: 5, total: "20.00", currency: "TRY" };
const EMAIL = { status: "sent", attempts: 1, lastAttemptAt: null, sentAt: null, lastError: null };

// The "X-Test-User" header stands in for a real login: "7:customer"
function fakeSession(req, res, next) {
  const header = req.get("X-Test-User");
  if (header) {
    const [id, role] = header.split(":");
    req.session = { user: { id: Number(id), role } };
  }
  next();
}

// Customer 7 owns order 5; findInvoice mimics the real ownership rule
async function startApp(t, overrides = {}) {
  const calls = { find: [], pdf: 0, email: [] };
  const store = {
    findInvoice: async (user, orderId) => {
      calls.find.push([user, orderId]);
      const visible = orderId === 5 && (user.role === "sales_manager" || user.id === 7);
      return visible ? INVOICE : null;
    },
    renderPdf: async () => {
      calls.pdf += 1;
      return Buffer.from("%PDF-1.3 fake");
    },
    sendEmail: async (orderId) => {
      calls.email.push(orderId);
      return EMAIL;
    },
    ...overrides,
  };
  const app = express();
  app.use(express.json());
  app.use(fakeSession);
  app.use("/orders", createInvoiceRouter({ store }));
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://localhost:${server.address().port}`;
  const call = (method, path, user = "7:customer") =>
    fetch(base + path, { method, headers: user ? { "X-Test-User": user } : {} });
  return { call, calls };
}

test("guests get 401 and other staff roles get 403 without reaching the store", async (t) => {
  const { call, calls } = await startApp(t);
  for (const [method, path] of [
    ["GET", "/orders/5/invoice"],
    ["GET", "/orders/5/invoice/pdf"],
    ["POST", "/orders/5/invoice/email"],
  ]) {
    assert.equal((await call(method, path, null)).status, 401);
    assert.equal((await call(method, path, "3:product_manager")).status, 403);
    assert.equal((await call(method, path, "4:support_agent")).status, 403);
  }
  assert.equal(calls.find.length, 0);
});

test("the owner gets the invoice data", async (t) => {
  const { call, calls } = await startApp(t);
  const res = await call("GET", "/orders/5/invoice");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { invoice: INVOICE });
  assert.deepEqual(calls.find[0], [{ id: 7, role: "customer" }, 5]);
});

test("another customer's order and a missing order both look like 404 ORDER_NOT_FOUND", async (t) => {
  const { call, calls } = await startApp(t);
  for (const [path, user] of [
    ["/orders/5/invoice", "8:customer"],
    ["/orders/6/invoice", "7:customer"],
    ["/orders/5/invoice/pdf", "8:customer"],
    ["/orders/5/invoice/email", "8:customer"],
  ]) {
    const res = await call(path.endsWith("email") ? "POST" : "GET", path, user);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, "ORDER_NOT_FOUND");
  }
  assert.equal(calls.pdf, 0);
  assert.equal(calls.email.length, 0);
});

test("invalid order IDs are 404 without a store lookup", async (t) => {
  const { call, calls } = await startApp(t);
  for (const id of ["abc", "0", "-1", "1.5"]) {
    assert.equal((await call("GET", `/orders/${id}/invoice`)).status, 404);
  }
  assert.equal(calls.find.length, 0);
});

test("the PDF is a private attachment named after the invoice number", async (t) => {
  const { call } = await startApp(t);
  const res = await call("GET", "/orders/5/invoice/pdf");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/pdf");
  assert.equal(res.headers.get("content-disposition"), 'attachment; filename="INV-2026-000005.pdf"');
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
});

test("sales managers can read any invoice", async (t) => {
  const { call } = await startApp(t);
  assert.equal((await call("GET", "/orders/5/invoice", "2:sales_manager")).status, 200);
  assert.equal((await call("GET", "/orders/5/invoice/pdf", "2:sales_manager")).status, 200);
});

test("the email endpoint returns the delivery state for the order", async (t) => {
  const { call, calls } = await startApp(t);
  const res = await call("POST", "/orders/5/invoice/email");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { email: EMAIL });
  assert.deepEqual(calls.email, [5]);
});

test("unexpected store errors become 500 INTERNAL_ERROR without details", async (t) => {
  const { call } = await startApp(t, {
    findInvoice: async () => {
      throw new Error("connection lost to sule@example.test");
    },
  });
  const original = console.error;
  console.error = () => {}; // keep the expected error out of the test output
  t.after(() => {
    console.error = original;
  });
  const res = await call("GET", "/orders/5/invoice");
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error.code, "INTERNAL_ERROR");
  assert.doesNotMatch(JSON.stringify(body), /example\.test/);
});