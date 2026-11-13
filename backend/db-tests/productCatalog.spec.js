// API checks for GET /products and GET /products/:id against MySQL and the SCRUM-21 seed.
// Needs the dobby_test database. Run with: npm run test:db
// Expected results are computed from the seed file, so the tests follow the catalogue.

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
const config = require("../config");
const { db } = require("../db/knex");
const { createApp } = require("../app");
const { KnexSessionStore } = require("../auth/sessionStore");
const { PRODUCTS } = require("../db/seeds/01_catalog");

let server;
let get;

// GET /products answers a plain array; pagination comes in the X-* headers.
// For list calls, body = { items, pagination } so the checks stay readable.
const json = async (path) => {
  const res = await get(path);
  const data = await res.json();
  if (res.status === 200 && Array.isArray(data)) {
    const h = (name) => Number(res.headers.get(name));
    return {
      status: res.status,
      headers: res.headers,
      body: {
        items: data,
        pagination: { page: h("x-page"), pageSize: h("x-page-size"), total: h("x-total-count"), totalPages: h("x-total-pages") },
      },
    };
  }
  return { status: res.status, body: data };
};
const ids = (items) => items.map((p) => p.id);
const allIdsSorted = PRODUCTS.map((p) => p.id).sort((a, b) => a - b);

before(async () => {
  await db.migrate.rollback(undefined, true);
  await db.migrate.latest();
  await db.seed.run();
  const app = createApp({ db, config, sessionStore: new KnexSessionStore({ db, cleanupIntervalMs: 0 }) });
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://localhost:${server.address().port}`;
  get = (path) => fetch(base + path);
});

after(async () => {
  await new Promise((r) => server.close(r));
  await db.destroy();
});

test("lists every seeded product with all agreed fields and pagination metadata", async () => {
  const { status, body } = await json("/products?pageSize=50");
  assert.equal(status, 200);
  assert.deepEqual(ids(body.items), allIdsSorted); // default order: product ID ascending
  assert.deepEqual(body.pagination, { page: 1, pageSize: 50, total: PRODUCTS.length, totalPages: 1 });

  const first = body.items[0];
  const seed = PRODUCTS.find((p) => p.id === first.id);
  assert.deepEqual(first, {
    id: seed.id,
    name: seed.name,
    model: seed.model,
    serialNumber: seed.serial_number,
    description: seed.description,
    category: "Speakers",
    categoryId: seed.category_id,
    price: seed.price,
    currency: "TRY",
    quantityInStock: seed.quantity_in_stock,
    inStock: seed.quantity_in_stock > 0,
    warrantyStatus: seed.warranty_status,
    distributor: seed.distributor,
    image: seed.image,
  });
});

test("search matches the description only, case-insensitively", async () => {
  // "beryllium" appears only in product 1's description (seed fixture)
  for (const term of ["beryllium", "BERYLLIUM", "BeRyLlIuM"]) {
    const { body } = await json(`/products?search=${term}`);
    assert.deepEqual(ids(body.items), [1], `search=${term}`);
  }
});

test("search matches names", async () => {
  const expected = PRODUCTS.filter((p) => /soundbar/i.test(p.name) || /soundbar/i.test(p.description))
    .map((p) => p.id)
    .sort((a, b) => a - b);
  const { body } = await json("/products?search=Soundbar");
  assert.deepEqual(ids(body.items), expected);
  assert.ok(expected.includes(2) && expected.includes(7));
});

test("search and category filter work together", async () => {
  const expected = PRODUCTS.filter((p) => p.category_id === 5 && /closed-back/i.test(`${p.name} ${p.description}`))
    .map((p) => p.id);
  const { body } = await json("/products?search=closed-back&categoryId=5");
  assert.deepEqual(ids(body.items), expected);
  assert.equal(body.items.length, 1);

  // Same search in another category: nothing
  const other = await json("/products?search=closed-back&categoryId=1");
  assert.deepEqual(other.body.items, []);
});

test("category filter alone returns only that category", async () => {
  const expected = PRODUCTS.filter((p) => p.category_id === 1).map((p) => p.id).sort((a, b) => a - b);
  const { body } = await json("/products?categoryId=1");
  assert.deepEqual(ids(body.items), expected);
  assert.ok(body.items.every((p) => p.category === "Speakers"));
});

test("zero results give an empty list with total 0, not an error", async () => {
  const { status, body } = await json("/products?search=no-such-product-xyz");
  assert.equal(status, 200);
  assert.deepEqual(body, { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });

  const unknownCategory = await json("/products?categoryId=999");
  assert.equal(unknownCategory.status, 200);
  assert.equal(unknownCategory.body.pagination.total, 0);
});

test("LIKE wildcards in the search are treated as normal characters", async () => {
  // Several descriptions contain "100" ("1000W"), but none contains "100%" or "_"
  assert.equal((await json("/products?search=100%25")).body.pagination.total, 0);
  assert.equal((await json("/products?search=_")).body.pagination.total, 0);
  assert.ok((await json("/products?search=100")).body.pagination.total > 0);
});

test("zero-stock products stay in the results with their exact stock", async () => {
  const zero = PRODUCTS.find((p) => p.quantity_in_stock === 0);
  const { body } = await json("/products?pageSize=50");
  const listed = body.items.find((p) => p.id === zero.id);
  assert.equal(listed.quantityInStock, 0);
  assert.equal(listed.inStock, false);

  const detail = await json(`/products/${zero.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.product.quantityInStock, 0);
});

test("fractional prices are returned exactly", async () => {
  const fractional = PRODUCTS.find((p) => !p.price.endsWith(".00"));
  const { body } = await json(`/products/${fractional.id}`);
  assert.equal(body.product.price, fractional.price); // "18749.90", not 18749.9
});

test("price sorting is correct and tied prices keep the product ID order", async () => {
  const asc = (await json("/products?sort=price_asc&pageSize=50")).body.items;
  const desc = (await json("/products?sort=price_desc&pageSize=50")).body.items;
  const cents = (p) => Math.round(Number(p.price) * 100);

  for (let i = 1; i < asc.length; i++) {
    assert.ok(cents(asc[i - 1]) <= cents(asc[i]), "ascending");
    assert.ok(cents(desc[i - 1]) >= cents(desc[i]), "descending");
  }

  // Products 7 and 9 have the same price (seed fixture): 7 comes first in both directions
  const tied = PRODUCTS.filter((p) => p.price === "24990.00").map((p) => p.id);
  assert.deepEqual(tied, [7, 9]);
  for (const list of [asc, desc]) {
    const order = ids(list).filter((id) => tied.includes(id));
    assert.deepEqual(order, [7, 9]);
  }
});

test("pagination splits the list without gaps or duplicates", async () => {
  const pages = [];
  for (let page = 1; page <= 3; page++) {
    const { body } = await json(`/products?sort=price_asc&pageSize=5&page=${page}`);
    assert.deepEqual(body.pagination, { page, pageSize: 5, total: PRODUCTS.length, totalPages: 3 });
    pages.push(...body.items);
  }
  const full = (await json("/products?sort=price_asc&pageSize=50")).body.items;
  assert.deepEqual(ids(pages), ids(full));

  // A page after the last one is empty but still reports the total
  const beyond = await json("/products?pageSize=5&page=4");
  assert.equal(beyond.status, 200);
  assert.deepEqual(beyond.body.items, []);
  assert.equal(beyond.body.pagination.total, PRODUCTS.length);
});

test("popularity sorts by paid units sold, then by product ID", async () => {
  const [customerId] = await db("users").insert({
    name: "Popularity Tester",
    email: "popularity@example.test",
    password_hash: "x".repeat(60),
    role: "customer",
    tax_id: "12345678901",
    home_address: "Orta Mah. Universite Cad. No:27, Tuzla",
  });
  let ref = 0;
  async function order(lines) {
    const [orderId] = await db("orders").insert({
      customer_id: customerId,
      total_price: "1.00",
      delivery_address: "Orta Mah. Universite Cad. No:27, Tuzla",
      payment_reference: `POP-TEST-${++ref}`,
    });
    for (const [productId, quantity] of lines) {
      const p = PRODUCTS.find((x) => x.id === productId);
      await db("order_items").insert({
        order_id: orderId, product_id: productId, product_name: p.name,
        product_model: p.model, unit_price: p.price, quantity,
      });
    }
  }
  // Units sold: product 3 -> 6 (two orders), product 12 -> 2, product 8 -> 2
  await order([[3, 5], [12, 2]]);
  await order([[3, 1], [8, 2]]);

  const { body } = await json("/products?sort=popularity&pageSize=50");
  const unsold = allIdsSorted.filter((id) => ![3, 8, 12].includes(id));
  // 8 and 12 are tied on 2 units: lower ID first; products with no sales follow in ID order
  assert.deepEqual(ids(body.items), [3, 8, 12, ...unsold]);
});

test("products taken off sale are hidden from the list and the detail page", async () => {
  await db("products").where({ id: 14 }).update({ is_active: false });
  try {
    const { body } = await json("/products?pageSize=50");
    assert.equal(ids(body.items).includes(14), false);
    assert.equal(body.pagination.total, PRODUCTS.length - 1);
    assert.equal((await get("/products/14")).status, 404);
  } finally {
    await db("products").where({ id: 14 }).update({ is_active: true });
  }
});

test("unknown and malformed product IDs answer 404; bad query parameters answer 400", async () => {
  for (const path of ["/products/9999", "/products/abc", "/products/0"]) {
    const { status, body } = await json(path);
    assert.equal(status, 404, path);
    assert.equal(body.error.code, "PRODUCT_NOT_FOUND");
  }
  const bad = await json("/products?sort=name&page=0");
  assert.equal(bad.status, 400);
  assert.deepEqual(Object.keys(bad.body.error.fields).sort(), ["page", "sort"]);
});

test("the frontend origin can read the pagination headers (CORS)", async () => {
  const res = await fetch(`http://localhost:${server.address().port}/products`, {
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:5173");
  const exposed = res.headers.get("access-control-expose-headers");
  for (const name of ["X-Total-Count", "X-Page", "X-Page-Size", "X-Total-Pages"]) {
    assert.ok(exposed.includes(name), name);
  }
});