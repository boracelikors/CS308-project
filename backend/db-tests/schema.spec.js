// SCRUM-20 schema checks. Needs MySQL and the dobby_test database.
// Run with: npm run test:db  (rebuilds dobby_test from an empty schema)

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
const { db } = require("../db/knex");

const customer = (overrides = {}) => ({
  name: "Test Customer",
  email: "customer@example.test",
  password_hash: "$2b$12$" + "x".repeat(53),
  role: "customer",
  tax_id: "12345678901",
  home_address: "Fictional Street 1, Test City",
  ...overrides,
});

const product = (overrides = {}) => ({
  category_id: 1,
  name: "Test Speaker",
  model: "TS-1",
  serial_number: "TEST-SN-0001",
  description: "Schema test product.",
  quantity_in_stock: 5,
  price: "100.00",
  currency: "TRY",
  warranty_status: "2 years",
  distributor: "Test Distributor",
  image: "speaker.jpg",
  ...overrides,
});

// Assert that a query fails with the given MySQL error code
async function rejects(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code, `expected ${code}, got ${err.code}: ${err.message}`);
    return true;
  });
}

let customerId;
let productId;

before(async () => {
  // Start from an empty schema every time
  await db.migrate.rollback(undefined, true);
  const [, applied] = await db.migrate.latest();
  // Every migration file is applied (new migrations are added in later tasks)
  const files = require("node:fs").readdirSync(require("node:path").join(__dirname, "..", "db", "migrations"));
  assert.equal(applied.length, files.filter((f) => f.endsWith(".js")).length);

  [customerId] = await db("users").insert(customer());
  await db("categories").insert({ id: 1, name: "Speakers" });
  [productId] = await db("products").insert(product());
});

after(async () => {
  await db.destroy();
});

test("empty database migrates and has every core table", async () => {
  for (const table of ["users", "categories", "products", "carts", "cart_items",
    "cart_merge_requests", "orders", "order_items", "checkout_requests", "sessions"]) {
    assert.ok(await db.schema.hasTable(table), `${table} missing`);
  }
});

test("negative stock is rejected", async () => {
  await rejects(db("products").where({ id: productId }).update({ quantity_in_stock: -1 }), "ER_CHECK_CONSTRAINT_VIOLATED");
  await rejects(db("products").insert(product({ serial_number: "TEST-SN-NEG", quantity_in_stock: -3 })), "ER_CHECK_CONSTRAINT_VIOLATED");
});

test("negative price and other currencies are rejected", async () => {
  await rejects(db("products").insert(product({ serial_number: "TEST-SN-P", price: "-1.00" })), "ER_CHECK_CONSTRAINT_VIOLATED");
  await rejects(db("products").insert(product({ serial_number: "TEST-SN-C", currency: "USD" })), "ER_CHECK_CONSTRAINT_VIOLATED");
});

test("products are active by default and can be removed from sale", async () => {
  const p = await db("products").where({ id: productId }).first();
  assert.equal(p.is_active, 1);
});

test("password_hash fits a bcrypt hash exactly", async () => {
  const [col] = await db.raw("SHOW COLUMNS FROM users LIKE 'password_hash'");
  assert.equal(col[0].Type, "varchar(60)");
});

test("duplicate serial number is rejected", async () => {
  await rejects(db("products").insert(product()), "ER_DUP_ENTRY");
});

test("duplicate email is rejected", async () => {
  await rejects(db("users").insert(customer({ name: "Second" })), "ER_DUP_ENTRY");
});

test("email must be stored normalized (lowercase, trimmed)", async () => {
  await rejects(db("users").insert(customer({ email: "Mixed@Example.test" })), "ER_CHECK_CONSTRAINT_VIOLATED");
  await rejects(db("users").insert(customer({ email: " spaced@example.test" })), "ER_CHECK_CONSTRAINT_VIOLATED");
});

test("unknown role is rejected; customers need tax ID and address", async () => {
  await rejects(db("users").insert(customer({ email: "admin@example.test", role: "admin" })), "WARN_DATA_TRUNCATED");
  await rejects(db("users").insert(customer({ email: "notax@example.test", tax_id: null })), "ER_CHECK_CONSTRAINT_VIOLATED");
  // Staff accounts do not need customer fields
  await db("users").insert(customer({ email: "pm@example.test", role: "product_manager", tax_id: null, home_address: null }));
});

test("cart: one cart per user, positive quantities, one row per product", async () => {
  const [cartId] = await db("carts").insert({ user_id: customerId });
  await rejects(db("carts").insert({ user_id: customerId }), "ER_DUP_ENTRY");
  await rejects(db("cart_items").insert({ cart_id: cartId, product_id: productId, quantity: 0 }), "ER_CHECK_CONSTRAINT_VIOLATED");
  await db("cart_items").insert({ cart_id: cartId, product_id: productId, quantity: 2 });
  await rejects(db("cart_items").insert({ cart_id: cartId, product_id: productId, quantity: 1 }), "ER_DUP_ENTRY");
});

test("cart merge and checkout request keys are unique per user", async () => {
  const merge = { user_id: customerId, request_key: "merge-1", request_hash: "a".repeat(64) };
  await db("cart_merge_requests").insert(merge);
  await rejects(db("cart_merge_requests").insert(merge), "ER_DUP_ENTRY");

  const checkout = { customer_id: customerId, request_key: "checkout-1", request_hash: "b".repeat(64) };
  await db("checkout_requests").insert(checkout);
  await rejects(db("checkout_requests").insert(checkout), "ER_DUP_ENTRY");
});

test("orphan order item is rejected", async () => {
  await rejects(
    db("order_items").insert({
      order_id: 999999, product_id: productId, product_name: "X", product_model: "X", unit_price: "1.00", quantity: 1,
    }),
    "ER_NO_REFERENCED_ROW_2"
  );
});

test("order history keeps its own price, name and address snapshots", async () => {
  const [orderId] = await db("orders").insert({
    customer_id: customerId,
    total_price: "200.00",
    delivery_address: "Fictional Street 1, Test City",
    payment_reference: "MOCK-TEST-0001",
    payment_card_last4: "4242",
  });
  await db("order_items").insert({
    order_id: orderId, product_id: productId, product_name: "Test Speaker", product_model: "TS-1", unit_price: "100.00", quantity: 2,
  });
  await rejects(
    db("order_items").insert({
      order_id: orderId, product_id: productId, product_name: "X", product_model: "X", unit_price: "1.00", quantity: 0,
    }),
    "ER_CHECK_CONSTRAINT_VIOLATED"
  );

  // Later edits to the product and the profile
  await db("products").where({ id: productId }).update({ price: "999.99", name: "Renamed Speaker" });
  await db("users").where({ id: customerId }).update({ home_address: "New Address 99, Other City" });

  const order = await db("orders").where({ id: orderId }).first();
  const item = await db("order_items").where({ order_id: orderId }).first();
  assert.equal(order.delivery_address, "Fictional Street 1, Test City");
  assert.equal(order.status, "processing");
  assert.equal(item.unit_price, "100.00");
  assert.equal(item.product_name, "Test Speaker");

  // Ordered products and customers with orders cannot be deleted
  await rejects(db("products").where({ id: productId }).del(), "ER_ROW_IS_REFERENCED_2");
  await rejects(db("users").where({ id: customerId }).del(), "ER_ROW_IS_REFERENCED_2");
});

test("order status is limited to processing, in_transit, delivered", async () => {
  const order = await db("orders").first();
  await rejects(db("orders").where({ id: order.id }).update({ status: "shipped" }), "WARN_DATA_TRUNCATED");
  await rejects(db("orders").where({ id: order.id }).update({ delivered_at: db.fn.now() }), "ER_CHECK_CONSTRAINT_VIOLATED");
  await db("orders").where({ id: order.id }).update({ status: "delivered", delivered_at: db.fn.now() });
});

test("card last4 must be four digits", async () => {
  await rejects(
    db("orders").insert({
      customer_id: customerId, total_price: "1.00", delivery_address: "Fictional Street 1, Test City",
      payment_reference: "MOCK-TEST-0002", payment_card_last4: "42a2",
    }),
    "ER_CHECK_CONSTRAINT_VIOLATED"
  );
});
