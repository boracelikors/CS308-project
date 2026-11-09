// SCRUM-21 seed checks. Needs MySQL and the dobby_test database.
// Run with: npm run test:db

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

process.env.NODE_ENV = "test";
const { db } = require("../db/knex");
const { PRODUCTS } = require("../db/seeds/01_catalog");

const R9_FIELDS = ["id", "name", "model", "serial_number", "description", "quantity_in_stock",
  "price", "warranty_status", "distributor"];
const IMAGES_DIR = path.join(__dirname, "..", "..", "frontend", "public", "images");

async function snapshot() {
  return {
    categories: await db("categories").orderBy("id").select("id", "name"),
    products: await db("products").orderBy("id")
      .select(...R9_FIELDS, "category_id", "currency", "image"),
  };
}

before(async () => {
  await db.migrate.rollback(undefined, true);
  await db.migrate.latest();
});

after(async () => {
  await db.destroy();
});

test("running the seeds twice gives the same catalogue without duplicates", async () => {
  await db.seed.run();
  const first = await snapshot();
  await db.seed.run();
  const second = await snapshot();
  assert.deepEqual(second, first);
  assert.equal(first.categories.length, 6);
  assert.equal(first.products.length, PRODUCTS.length);
  assert.ok(first.products.length >= 12);
});

test("every product has every R9 field, TRY currency and a distinct name", async () => {
  const products = await db("products");
  for (const p of products) {
    for (const field of R9_FIELDS) {
      assert.ok(p[field] !== null && p[field] !== "", `product ${p.id} missing ${field}`);
    }
    assert.equal(p.currency, "TRY");
    assert.match(p.serial_number, /^DEMO-/, "demo data is marked");
  }
  assert.equal(new Set(products.map((p) => p.name)).size, products.length);
  assert.equal(new Set(products.map((p) => p.description)).size, products.length);
});

test("all six categories are used", async () => {
  const rows = await db("products").distinct("category_id");
  assert.equal(rows.length, 6);
});

test("Sprint 1 products keep their IDs, names, prices and images", async () => {
  const sample = require("../sample-products.json");
  for (const s of sample) {
    const p = await db("products").where({ id: s.id }).first();
    assert.equal(p.name, s.name);
    assert.equal(Number(p.price), s.price);
    assert.equal(p.image, s.image);
  }
});

test("every image file exists in frontend/public/images", () => {
  for (const p of PRODUCTS) {
    assert.ok(fs.existsSync(path.join(IMAGES_DIR, p.image)), `missing image ${p.image}`);
  }
});

test("edge-case fixtures exist", async () => {
  assert.equal((await db("products").where({ id: 7 }).first()).quantity_in_stock, 0);
  assert.equal((await db("products").where({ id: 8 }).first()).quantity_in_stock, 1);
  assert.equal((await db("products").where({ id: 10 }).first()).price, "18749.90");
  const equal = await db("products").where({ price: "24990.00" }).orderBy("id").pluck("id");
  assert.deepEqual(equal, [7, 9]);
});

test("'beryllium' is found only through a description", async () => {
  const byName = await db("products").whereILike("name", "%beryllium%");
  assert.equal(byName.length, 0);
  const byDescription = await db("products").whereILike("description", "%beryllium%").pluck("id");
  assert.deepEqual(byDescription, [1]);
  const fulltext = await db("products")
    .whereRaw("MATCH(name, description) AGAINST (? IN NATURAL LANGUAGE MODE)", ["beryllium"])
    .pluck("id");
  assert.deepEqual(fulltext, [1]);
});
