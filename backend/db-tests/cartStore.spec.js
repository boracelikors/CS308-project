// cart/cartStore.js against real MySQL with the demo catalogue (SCRUM-28).
// Needs the dobby_test database. Run with: npm run test:db
//
// Demo products used (db/seeds/01_catalog.js):
//   1  89900.00, stock 4      7  stock 0      8  149900.00, stock 1 (last item)
//   10 18749.90 (fractional), stock 7         11 9990.00, stock 15

const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
const { db } = require("../db/knex");
const { createUser } = require("../users/userStore");
const { getCart, addItem, setItemQuantity, removeItem } = require("../cart/cartStore");

let alice;
let bob;

function customer(email) {
  return {
    name: "Test Customer",
    email,
    passwordHash: "$2b$12$" + "x".repeat(53),
    role: "customer",
    taxId: "12345678901",
    homeAddress: "Orta Mah. Universite Cad. No:27, Tuzla",
  };
}

before(async () => {
  await db.migrate.rollback(undefined, true);
  await db.migrate.latest();
  await db.seed.run();
  alice = await createUser(db, customer("alice@example.com"));
  bob = await createUser(db, customer("bob@example.com"));
});

// Every test starts with empty carts and the original stock and sale status
beforeEach(async () => {
  await db("cart_items").del();
  await db.seed.run();
  await db("products").update({ is_active: true });
});

after(async () => {
  await db.destroy();
});

test("a new customer has an empty cart", async () => {
  assert.deepEqual(await getCart(db, alice.id), { items: [], subtotal: "0.00", currency: null });
});

test("adding a product returns the cart with exact prices from the database", async () => {
  const cart = await addItem(db, alice.id, 1, 2);
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].productId, 1);
  assert.equal(cart.items[0].unitPrice, "89900.00");
  assert.equal(cart.items[0].lineTotal, "179800.00");
  assert.equal(cart.subtotal, "179800.00");
  assert.equal(cart.currency, "TRY");
});

test("fractional prices add up exactly", async () => {
  const cart = await addItem(db, alice.id, 10, 3);
  assert.equal(cart.items[0].lineTotal, "56249.70");
});

test("adding the same product again increases the quantity, one row only", async () => {
  await addItem(db, alice.id, 11, 2);
  const cart = await addItem(db, alice.id, 11, 3);
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].quantity, 5);
  const [{ count }] = await db("cart_items").count({ count: "*" });
  assert.equal(Number(count), 1);
});

test("the cart is still there when read again later (persistent)", async () => {
  await addItem(db, alice.id, 11, 2);
  const cart = await getCart(db, alice.id);
  assert.equal(cart.items[0].quantity, 2);
});

test("more than the stock is rejected with the available amount; cart unchanged", async () => {
  await addItem(db, alice.id, 1, 3);
  await assert.rejects(() => addItem(db, alice.id, 1, 2), {
    code: "INSUFFICIENT_STOCK",
    available: 4,
  });
  assert.equal((await getCart(db, alice.id)).items[0].quantity, 3);
});

test("out-of-stock product cannot be added", async () => {
  await assert.rejects(() => addItem(db, alice.id, 7, 1), { code: "OUT_OF_STOCK" });
});

test("unknown or removed-from-sale product cannot be added", async () => {
  await assert.rejects(() => addItem(db, alice.id, 9999, 1), { code: "PRODUCT_NOT_FOUND" });
  await db("products").where({ id: 11 }).update({ is_active: false });
  await assert.rejects(() => addItem(db, alice.id, 11, 1), { code: "PRODUCT_NOT_FOUND" });
});

test("invalid quantities are rejected before touching the database", async () => {
  for (const quantity of [0, -1, 1.5, "2", null]) {
    await assert.rejects(() => addItem(db, alice.id, 11, quantity), { code: "INVALID_QUANTITY" });
  }
  assert.equal((await getCart(db, alice.id)).items.length, 0);
});

test("two customers have separate carts", async () => {
  await addItem(db, alice.id, 11, 1);
  await addItem(db, bob.id, 9, 4);
  assert.deepEqual((await getCart(db, alice.id)).items.map((i) => i.productId), [11]);
  assert.deepEqual((await getCart(db, bob.id)).items.map((i) => i.productId), [9]);
});

test("setItemQuantity changes the quantity and checks stock", async () => {
  await addItem(db, alice.id, 1, 1);
  assert.equal((await setItemQuantity(db, alice.id, 1, 4)).items[0].quantity, 4);
  await assert.rejects(() => setItemQuantity(db, alice.id, 1, 5), { code: "INSUFFICIENT_STOCK" });
  await assert.rejects(() => setItemQuantity(db, alice.id, 1, 0), { code: "INVALID_QUANTITY" });
});

test("setItemQuantity on a product that is not in the cart is CART_ITEM_NOT_FOUND", async () => {
  await assert.rejects(() => setItemQuantity(db, alice.id, 11, 1), { code: "CART_ITEM_NOT_FOUND" });
});

test("removeItem removes the line; removing again is not an error", async () => {
  await addItem(db, alice.id, 11, 1);
  await addItem(db, alice.id, 9, 1);
  const cart = await removeItem(db, alice.id, 11);
  assert.deepEqual(cart.items.map((i) => i.productId), [9]);
  const again = await removeItem(db, alice.id, 11);
  assert.deepEqual(again.items.map((i) => i.productId), [9]);
  assert.deepEqual(await removeItem(db, bob.id, 11), { items: [], subtotal: "0.00", currency: null });
});

test("products that change after being added are flagged and left out of the subtotal", async () => {
  await addItem(db, alice.id, 11, 1); // stays fine: 9990.00
  await addItem(db, alice.id, 1, 3);
  await addItem(db, alice.id, 9, 1);
  await addItem(db, alice.id, 10, 1);
  await db("products").where({ id: 1 }).update({ quantity_in_stock: 2 });
  await db("products").where({ id: 9 }).update({ quantity_in_stock: 0 });
  await db("products").where({ id: 10 }).update({ is_active: false });

  const cart = await getCart(db, alice.id);
  assert.deepEqual(
    cart.items.map((i) => [i.productId, i.problem]),
    [[11, null], [1, "INSUFFICIENT_STOCK"], [9, "OUT_OF_STOCK"], [10, "UNAVAILABLE"]]
  );
  assert.equal(cart.items[1].stock, 2);
  assert.equal(cart.subtotal, "9990.00");
});

test("price changes show up in the cart (prices are never stored in the cart)", async () => {
  await addItem(db, alice.id, 11, 2);
  await db("products").where({ id: 11 }).update({ price: "8500.50" });
  assert.equal((await getCart(db, alice.id)).subtotal, "17001.00");
});

test("two simultaneous adds of the last item: only one fits", async () => {
  const results = await Promise.allSettled([addItem(db, alice.id, 8, 1), addItem(db, alice.id, 8, 1)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.find((r) => r.status === "rejected").reason.code, "INSUFFICIENT_STOCK");
  assert.equal((await getCart(db, alice.id)).items[0].quantity, 1);
});

test("first-ever adds arriving at the same time do not deadlock", async () => {
  const carol = await createUser(db, customer("carol@example.com"));
  const results = await Promise.allSettled([
    addItem(db, carol.id, 11, 1),
    addItem(db, carol.id, 11, 1),
    addItem(db, carol.id, 9, 1),
  ]);
  assert.deepEqual(results.map((r) => r.status), ["fulfilled", "fulfilled", "fulfilled"]);
  const cart = await getCart(db, carol.id);
  assert.equal(cart.items.find((i) => i.productId === 11).quantity, 2);
  assert.equal(cart.items.length, 2);
});

test("adding to the cart does not change product stock", async () => {
  await addItem(db, alice.id, 1, 4);
  const product = await db("products").where({ id: 1 }).first("quantity_in_stock");
  assert.equal(product.quantity_in_stock, 4);
});
