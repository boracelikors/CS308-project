// POST /cart/merge: adds the guest cart (kept in the browser) to the logged-in
// customer's cart, once per request key.
//
// Everything happens in ONE transaction that first locks the customer's cart row:
//   1. look up the request key for this customer
//      - same key, same items  -> replay: the first adjustments and the current cart
//      - same key, other items -> MergeKeyReused (422 REQUEST_KEY_REUSED)
//   2. read the current cart lines and products, apply the merge rules (mergePlan.js)
//   3. write the cart lines and record the key with the adjustments
// Because every merge of one customer waits for the same cart lock, two retries that
// arrive at the same time run one after the other and the second one replays.
// Prices and totals always come from the database (buildCartView).
const { buildCartView, ensureCart, lockCart, loadRows } = require("./cartStore");
const { planMerge } = require("./mergePlan");

class MergeKeyReused extends Error {
  constructor() {
    super("This requestKey was already used for a different guest cart.");
    this.code = "REQUEST_KEY_REUSED";
  }
}

function storedAdjustments(row) {
  const body = typeof row.response_body === "string" ? JSON.parse(row.response_body) : row.response_body;
  return body?.adjustments ?? [];
}

async function replay(trx, cartId, prior, hash) {
  if (prior.request_hash !== hash) throw new MergeKeyReused();
  return {
    cart: buildCartView(await loadRows(trx, cartId)),
    adjustments: storedAdjustments(prior),
    replayed: true,
  };
}

const findRequest = (q, userId, requestKey) =>
  q("cart_merge_requests")
    .where({ user_id: userId, request_key: requestKey })
    .first("request_hash", "response_body");

// items: validated and normalized by validateMerge; hash: requestHash(items)
// Returns { cart, adjustments, replayed }
async function mergeGuestCart(db, userId, { requestKey, items, hash }) {
  await ensureCart(db, userId);
  try {
    return await db.transaction(async (trx) => {
      const cartId = await lockCart(trx, userId);

      const prior = await findRequest(trx, userId, requestKey);
      if (prior) return replay(trx, cartId, prior, hash);

      const productIds = items.map((item) => item.productId);
      const lines = await trx("cart_items")
        .where("cart_id", cartId)
        .whereIn("product_id", productIds)
        .select("product_id as productId", "quantity");
      const products = await trx("products")
        .whereIn("id", productIds)
        .select("id", "name", "quantity_in_stock as stock", "is_active as isActive");

      const { writes, adjustments } = planMerge(
        items,
        new Map(lines.map((l) => [l.productId, l.quantity])),
        new Map(products.map((p) => [p.id, { name: p.name, stock: p.stock, isActive: Boolean(p.isActive) }]))
      );

      for (const { productId, quantity, isNew } of writes) {
        if (isNew) {
          await trx("cart_items").insert({ cart_id: cartId, product_id: productId, quantity });
        } else {
          await trx("cart_items").where({ cart_id: cartId, product_id: productId }).update({ quantity });
        }
      }

      await trx("cart_merge_requests").insert({
        user_id: userId,
        request_key: requestKey,
        request_hash: hash,
        response_body: JSON.stringify({ adjustments }),
      });

      return { cart: buildCartView(await loadRows(trx, cartId)), adjustments, replayed: false };
    });
  } catch (err) {
    // Safety net: the unique (user_id, request_key) index caught a duplicate that slipped
    // past the cart lock. The other request was applied, so replay its result.
    if (err.code !== "ER_DUP_ENTRY") throw err;
    return db.transaction(async (trx) => {
      const cartId = await lockCart(trx, userId);
      return replay(trx, cartId, await findRequest(trx, userId, requestKey), hash);
    });
  }
}

module.exports = { mergeGuestCart, MergeKeyReused };