// POST /checkout logic (SCRUM-34): turns the customer's server cart into one paid order.
//
// Order of work:
//   1. Claim the requestKey (one row in checkout_requests per customer + key).
//   2. Re-read the cart with current prices and stock; stop if empty, unavailable,
//      or if the total differs from what the customer confirmed (review required).
//   3. Charge the mock bank (test payment only).
//   4. In ONE transaction: lock the cart and the products, decrement stock only
//      if enough is left, create the order and its item snapshots, clear the
//      purchased cart lines, and store the response under the key.
//   5. If step 4 fails after a successful charge, the charge is voided.
//
// A key is released (row deleted) when nothing happened yet, so the same key can be
// retried. Once the bank has been called, the outcome is stored and every retry with
// that key gets the same answer: no second charge and no second order.
const { buildCartView } = require("../cart/cartStore");
const { toMinorUnits, formatMinorUnits } = require("../cart/cartMath");
const { requestHash } = require("./validateCheckout");

class CheckoutConflict extends Error {
  constructor(code, message, cart) {
    super(message);
    this.code = code;
    this.cart = cart;
  }
}

// Error codes follow the contract the frontend proposed in SCRUM-38 (checkoutApi.js):
// EMPTY_CART, CART_CHANGED, OUT_OF_STOCK and PAYMENT_DECLINED show a known outcome;
// 5xx means "unknown", and the frontend retries with the same requestKey and body.
const reply = (status, code, message, extra = {}) => ({
  status,
  body: { error: { code, message, ...extra } },
});

// ---------- idempotency key ----------

// 503: the outcome is not known yet, so the frontend retries with the same key
const inProgress = () =>
  reply(503, "CHECKOUT_IN_PROGRESS", "This checkout is still being processed. Please check again in a moment.");

async function claimKey(db, userId, key, hash) {
  try {
    const [id] = await db("checkout_requests").insert({
      customer_id: userId,
      request_key: key,
      request_hash: hash,
      status: "pending",
    });
    return { id };
  } catch (err) {
    if (err.code !== "ER_DUP_ENTRY") throw err;
  }
  const row = await db("checkout_requests")
    .where({ customer_id: userId, request_key: key })
    .first("request_hash", "status", "response_status", "response_body");
  if (!row) {
    // The other request released the key between our insert and this read
    return { response: inProgress() };
  }
  if (row.request_hash !== hash) {
    return {
      response: reply(422, "REQUEST_KEY_REUSED", "This requestKey was already used for a different checkout."),
    };
  }
  if (row.status === "pending") return { response: inProgress() };
  const body = typeof row.response_body === "string" ? JSON.parse(row.response_body) : row.response_body;
  return { response: { status: row.response_status, body, replayed: true } };
}

const releaseKey = (db, id) => db("checkout_requests").where({ id }).del();

function storeOutcome(q, id, status, response, orderId = null) {
  return q("checkout_requests")
    .where({ id })
    .update({
      status,
      order_id: orderId,
      response_status: response.status,
      response_body: JSON.stringify(response.body),
    });
}

// ---------- cart and order reads ----------

async function loadCart(q, userId, { lock = false } = {}) {
  let cartQuery = q("carts").where({ user_id: userId });
  if (lock) cartQuery = cartQuery.forUpdate();
  const cart = await cartQuery.first("id");
  if (!cart) return { cartId: null, rows: [] };

  const items = await q("cart_items").where({ cart_id: cart.id }).orderBy("id").select("product_id", "quantity");
  if (items.length === 0) return { cartId: cart.id, rows: [] };

  // Products are locked in ID order so two checkouts never wait on each other in a circle
  let productQuery = q("products")
    .whereIn("id", items.map((i) => i.product_id))
    .orderBy("id")
    .select("id", "name", "model", "image", "price", "currency", "quantity_in_stock", "is_active");
  if (lock) productQuery = productQuery.forUpdate();
  const byId = new Map((await productQuery).map((p) => [p.id, p]));

  const rows = items.map((i) => {
    const p = byId.get(i.product_id);
    return {
      productId: p.id,
      name: p.name,
      model: p.model,
      image: p.image,
      price: p.price,
      currency: p.currency,
      quantity: i.quantity,
      stock: p.quantity_in_stock,
      isActive: p.is_active,
    };
  });
  return { cartId: cart.id, rows };
}

// Shared shape for one order (also used by GET /orders/:id in SCRUM-35).
// Field names follow the frontend proposals in SCRUM-38 and SCRUM-39.
function orderView(order, items) {
  return {
    id: order.id,
    status: order.status,
    createdAt: order.created_at,
    inTransitAt: order.in_transit_at,
    deliveredAt: order.delivered_at,
    deliveryAddress: order.delivery_address,
    total: order.total_price,
    currency: order.currency,
    paymentMode: "test", // mock payment only; no money was charged
    paymentReference: order.payment_reference,
    cardLast4: order.payment_card_last4,
    items: items.map((it) => ({
      productId: it.product_id,
      productName: it.product_name,
      productModel: it.product_model,
      unitPrice: it.unit_price, // purchase-time price, not today's catalogue price
      quantity: it.quantity,
      lineTotal: formatMinorUnits(toMinorUnits(it.unit_price) * it.quantity),
    })),
  };
}

// ---------- the transaction ----------

async function createOrder(trx, { userId, requestId, chargedTotal, deliveryAddress, payment, hooks }) {
  const { cartId, rows } = await loadCart(trx, userId, { lock: true });
  if (rows.length === 0) throw new CheckoutConflict("EMPTY_CART", "Your cart is empty.");

  const view = buildCartView(rows);
  if (view.items.some((i) => i.problem !== null)) {
    throw new CheckoutConflict("OUT_OF_STOCK", "Some items are no longer available in this quantity.", view);
  }
  if (view.subtotal !== chargedTotal) {
    throw new CheckoutConflict("CART_CHANGED", "Prices changed. Please review your cart and confirm again.", view);
  }

  // Conditional update: only succeeds if enough stock is still there
  for (const row of rows) {
    const changed = await trx("products")
      .where({ id: row.productId, is_active: true })
      .andWhere("quantity_in_stock", ">=", row.quantity)
      .decrement("quantity_in_stock", row.quantity);
    if (changed !== 1) {
      throw new CheckoutConflict("OUT_OF_STOCK", "Some items are no longer available in this quantity.", view);
    }
  }
  if (hooks.afterStockUpdate) await hooks.afterStockUpdate(); // tests only: simulate a failure here

  const [orderId] = await trx("orders").insert({
    customer_id: userId,
    status: "processing",
    total_price: view.subtotal,
    currency: view.currency,
    delivery_address: deliveryAddress,
    payment_reference: payment.reference,
    payment_card_last4: payment.cardLast4,
  });
  await trx("order_items").insert(
    rows.map((r) => ({
      order_id: orderId,
      product_id: r.productId,
      product_name: r.name,
      product_model: r.model,
      unit_price: r.price,
      quantity: r.quantity,
    }))
  );
  await trx("cart_items")
    .where({ cart_id: cartId })
    .whereIn("product_id", rows.map((r) => r.productId))
    .del();

  const order = await trx("orders").where({ id: orderId }).first();
  const items = await trx("order_items").where({ order_id: orderId }).orderBy("id");
  const response = { status: 201, body: { order: orderView(order, items) } };
  await storeOutcome(trx, requestId, "succeeded", response, orderId);
  return response;
}

// ---------- entry point ----------

// input: the validated value from validateCheckout()
// Returns { status, body } for the route to send.
async function checkout(db, bank, { userId, key, input, hooks = {} }) {
  const claim = await claimKey(db, userId, key, requestHash(input));
  if (claim.response) return claim.response;
  const requestId = claim.id;

  let payment = null;
  try {
    const user = await db("users").where({ id: userId }).first("home_address");
    const deliveryAddress = input.deliveryAddress ?? user?.home_address ?? null;
    if (!deliveryAddress) {
      await releaseKey(db, requestId);
      return reply(400, "VALIDATION_ERROR", "Some fields are invalid.", {
        fields: { deliveryAddress: "Enter a delivery address." },
      });
    }

    const { rows } = await loadCart(db, userId);
    if (rows.length === 0) {
      await releaseKey(db, requestId);
      return reply(400, "EMPTY_CART", "Your cart is empty.");
    }
    const view = buildCartView(rows);
    if (view.items.some((i) => i.problem !== null)) {
      await releaseKey(db, requestId);
      return reply(409, "CART_CHANGED", "Some items in your cart cannot be bought right now.", { cart: view });
    }
    if (view.subtotal !== input.expectedTotal) {
      await releaseKey(db, requestId);
      return reply(409, "CART_CHANGED", "Your cart total changed. Please review it and confirm again.", {
        cart: view,
      });
    }

    const result = await bank.charge({ amountMinor: toMinorUnits(view.subtotal), card: input.card });
    if (!result.approved) {
      const response = reply(402, "PAYMENT_DECLINED", "The test bank declined this card. Nothing was charged.");
      await storeOutcome(db, requestId, "declined", response);
      return response;
    }
    payment = result;

    return await db.transaction((trx) =>
      createOrder(trx, { userId, requestId, chargedTotal: view.subtotal, deliveryAddress, payment, hooks })
    );
  } catch (err) {
    if (payment) await bank.void(payment.reference); // the order was not created: give the money back
    if (err instanceof CheckoutConflict) {
      const extra = err.cart ? { cart: err.cart } : {};
      const response = reply(409, err.code, `${err.message} Your payment was cancelled.`, extra);
      await storeOutcome(db, requestId, "failed", response);
      return response;
    }
    // Unexpected failure: nothing was kept, so the same key may be retried
    await releaseKey(db, requestId).catch(() => {});
    throw err;
  }
}

// A reload may lose the in-memory payment body. Resolve by key without sending card data.
// If no request arrived, atomically reserve a cancelled key so a delayed POST cannot buy later.
async function resolveAttempt(db, userId, key) {
  const cancelled = { error: { code: "CHECKOUT_CANCELLED", message: "This attempt was cancelled before submission. Start a new attempt." } };
  try {
    await db("checkout_requests").insert({ customer_id: userId, request_key: key,
      request_hash: "cancelled-before-submission", status: "failed", response_status: 409,
      response_body: JSON.stringify(cancelled) });
  } catch (error) { if (error.code !== "ER_DUP_ENTRY") throw error; }
  const row = await db("checkout_requests").where({ customer_id: userId, request_key: key }).first();
  // A concurrent failed request may release its key. Retry, rather than declaring a new attempt safe.
  if (!row || row.status === "pending") return { phase: "pending" };
  const body = typeof row.response_body === "string" ? JSON.parse(row.response_body) : row.response_body;
  return row.status === "succeeded" ? { phase: "succeeded", order: body.order } : { phase: "failed", error: body.error };
}
module.exports = { checkout, orderView, CheckoutConflict, resolveAttempt };
