// HTTP tests for GET /products and GET /products/:id with a fake store (no database needed)
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createProductRouter } = require("../products/productRoutes");
const { errorHandler } = require("../http/errorHandler");

const PRODUCT = { id: 1, name: "Monitors", price: "89900.00", quantityInStock: 4 };
const PAGE = { items: [PRODUCT], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } };

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
  app.use("/products", createProductRouter({ store: recording }));
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://localhost:${server.address().port}`;
  return { get: (path) => fetch(base + path), calls };
}

const okStore = {
  listProducts: async () => PAGE,
  getProduct: async (id) => (id === 1 ? PRODUCT : null),
};

test("GET /products returns a plain array with pagination headers", async (t) => {
  const { get, calls } = await startApp(t, okStore);
  const res = await get("/products");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), [PRODUCT]); // Sprint 1 shape: the frontend needs no change
  assert.equal(res.headers.get("x-total-count"), "1");
  assert.equal(res.headers.get("x-page"), "1");
  assert.equal(res.headers.get("x-page-size"), "20");
  assert.equal(res.headers.get("x-total-pages"), "1");
  assert.deepEqual(calls, [
    ["listProducts", { search: null, categoryId: null, sort: null, page: 1, pageSize: 20 }],
  ]);
});

test("GET /products passes validated filters to the store", async (t) => {
  const { get, calls } = await startApp(t, okStore);
  await get("/products?search=%20Tube%20&categoryId=4&sort=popularity&page=2&pageSize=5");
  assert.deepEqual(calls[0][1], { search: "Tube", categoryId: 4, sort: "popularity", page: 2, pageSize: 5 });
});

test("GET /products with invalid parameters answers 400 and does not query the store", async (t) => {
  const { get, calls } = await startApp(t, okStore);
  const res = await get("/products?sort=cheapest&pageSize=500");
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "VALIDATION_ERROR");
  assert.ok(body.error.fields.sort);
  assert.ok(body.error.fields.pageSize);
  assert.equal(calls.length, 0);
});

test("GET /products/:id returns the product", async (t) => {
  const { get } = await startApp(t, okStore);
  const res = await get("/products/1");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { product: PRODUCT });
});

test("GET /products/:id answers 404 for an unknown product", async (t) => {
  const { get } = await startApp(t, okStore);
  const res = await get("/products/999");
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, "PRODUCT_NOT_FOUND");
});

test("GET /products/:id answers 404 for a malformed ID without querying the store", async (t) => {
  const { get, calls } = await startApp(t, okStore);
  for (const id of ["abc", "0", "-1", "1.5"]) {
    const res = await get(`/products/${id}`);
    assert.equal(res.status, 404, `id=${id}`);
  }
  assert.equal(calls.length, 0);
});

test("a database failure becomes a 500 without internal details", async (t) => {
  const { get } = await startApp(t, {
    listProducts: async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:3306");
    },
    getProduct: async () => null,
  });
  const original = console.error;
  console.error = () => {}; // the error handler logs the real error; keep test output clean
  t.after(() => {
    console.error = original;
  });
  const res = await get("/products");
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error.code, "INTERNAL_ERROR");
  assert.equal(JSON.stringify(body).includes("ECONNREFUSED"), false);
});