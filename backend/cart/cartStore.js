// Persistent cart for logged-in customers (SCRUM-28).
// Every function takes the user ID from the session (never from the client)
// and returns the cart in the shape described in the Sprint 2 API draft.
// Prices are always read from products; nothing about money is stored in the cart.
const { toMinorUnits, formatMinorUnits, validateQuantity } = require("./cartMath");

class CartError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    Object.assign(this, extra);
  }
}

// HTTP status for each error code, used by the cart routes
const CART_ERROR_STATUS = {
  INVALID_QUANTITY: 400,
  PRODUCT_NOT_FOUND: 404,
  CART_ITEM_NOT_FOUND: 404,
  OUT_OF_STOCK: 409,
  INSUFFICIENT_STOCK: 409,
};

// Why a line can't be bought right now (product changed after it was added), or null
function lineProblem({ isActive, stock, quantity }) {
  if (!isActive) return "UNAVAILABLE";
  if (stock <= 0) return "OUT_OF_STOCK";
  if (quantity > stock) return "INSUFFICIENT_STOCK";
  return null;
}

// rows: [{ productId, name, image, price: "1499.90", currency, quantity, stock, isActive }]
// Lines with a problem are shown but not counted in the subtotal.
function buildCartView(rows) {
  let subtotalMinor = 0;
  const items = rows.map((row) => {
    const isActive = Boolean(row.isActive);
    const unitMinor = toMinorUnits(row.price);
    const lineMinor = unitMinor * row.quantity;
    const problem = lineProblem({ isActive, stock: row.stock, quantity: row.quantity });
    if (problem === null) {
      if (row.currency !== rows[0].currency) {
        throw new Error("All cart lines must use the same currency.");
      }
      subtotalMinor += lineMinor;
    }
    return {
      productId: row.productId,
      name: row.name,
      image: row.image,
      unitPrice: formatMinorUnits(unitMinor),
      currency: row.currency,
      quantity: row.quantity,
      lineTotal: formatMinorUnits(lineMinor),
      stock: row.stock,
      problem,
    };
  });
  return {
    items,
    subtotal: formatMinorUnits(subtotalMinor),
    currency: rows.length > 0 ? rows[0].currency : null,
  };
}

function loadRows(q, cartId) {
  return q("cart_items as ci")
    .join("products as p", "p.id", "ci.product_id")
    .where("ci.cart_id", cartId)
    .orderBy("ci.id") // the order in which products were added
    .select(
      "ci.product_id as productId",
      "p.name",
      "p.image",
      "p.price",
      "p.currency",
      "ci.quantity",
      "p.quantity_in_stock as stock",
      "p.is_active as isActive"
    );
}

// Creates the user's cart if it does not exist yet. Runs on its own, outside the
// changing transaction: doing this inside it made two first-time adds deadlock.
async function ensureCart(db, userId) {
  await db("carts").insert({ user_id: userId }).onConflict("user_id").ignore();
}

// Locks the user's cart row until the transaction ends, so two requests
// changing the same cart run one after the other.
async function lockCart(trx, userId) {
  const cart = await trx("carts").where({ user_id: userId }).forUpdate().first("id");
  return cart.id;
}

function assertQuantity(quantity) {
  const check = validateQuantity(quantity, Number.MAX_SAFE_INTEGER);
  if (!check.ok) throw new CartError(check.code, check.message);
}

async function findSellableProduct(trx, productId) {
  if (!Number.isInteger(productId) || productId < 1) return null;
  const product = await trx("products")
    .where({ id: productId })
    .first("id", "quantity_in_stock as stock", "is_active as isActive");
  return product && Boolean(product.isActive) ? product : null;
}

function assertStock(quantity, stock) {
  const check = validateQuantity(quantity, stock);
  if (!check.ok) {
    const extra = check.available === undefined ? {} : { available: check.available };
    throw new CartError(check.code, check.message, extra);
  }
}

async function getCart(db, userId) {
  const cart = await db("carts").where({ user_id: userId }).first("id");
  return buildCartView(cart ? await loadRows(db, cart.id) : []);
}

// Adds a product, or increases its quantity if it is already in the cart.
// The total quantity in the cart may not exceed the current stock.
async function addItem(db, userId, productId, quantity) {
  assertQuantity(quantity);
  await ensureCart(db, userId);
  return db.transaction(async (trx) => {
    const cartId = await lockCart(trx, userId);
    const product = await findSellableProduct(trx, productId);
    if (!product) throw new CartError("PRODUCT_NOT_FOUND", "This product does not exist.");

    const existing = await trx("cart_items")
      .where({ cart_id: cartId, product_id: productId })
      .first("id", "quantity");
    const newQuantity = (existing ? existing.quantity : 0) + quantity;
    assertStock(newQuantity, product.stock);

    if (existing) {
      await trx("cart_items").where({ id: existing.id }).update({ quantity: newQuantity });
    } else {
      await trx("cart_items").insert({ cart_id: cartId, product_id: productId, quantity: newQuantity });
    }
    return buildCartView(await loadRows(trx, cartId));
  });
}

// Sets the quantity of a product that is already in the cart.
async function setItemQuantity(db, userId, productId, quantity) {
  assertQuantity(quantity);
  await ensureCart(db, userId);
  return db.transaction(async (trx) => {
    const cartId = await lockCart(trx, userId);
    const existing = await trx("cart_items")
      .where({ cart_id: cartId, product_id: productId })
      .first("id");
    if (!existing) throw new CartError("CART_ITEM_NOT_FOUND", "This product is not in your cart.");

    const product = await findSellableProduct(trx, productId);
    if (!product) throw new CartError("PRODUCT_NOT_FOUND", "This product is no longer sold.");
    assertStock(quantity, product.stock);

    await trx("cart_items").where({ id: existing.id }).update({ quantity });
    return buildCartView(await loadRows(trx, cartId));
  });
}

// Removes a product from the cart; removing something that is not there is not an error.
async function removeItem(db, userId, productId) {
  const cart = await db("carts").where({ user_id: userId }).first("id");
  if (cart) {
    await db("cart_items").where({ cart_id: cart.id, product_id: productId }).del();
  }
  return getCart(db, userId);
}

module.exports = {
  CartError,
  CART_ERROR_STATUS,
  lineProblem,
  buildCartView,
  getCart,
  addItem,
  setItemQuantity,
  removeItem,
};
