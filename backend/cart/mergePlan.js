// The merge rules for POST /cart/merge, as a pure function (no database).
//
// For every guest line:
//   requested = quantity already in the account cart + guest quantity
//   - product unknown or taken off sale -> nothing added, reason PRODUCT_UNAVAILABLE
//   - product out of stock              -> nothing added, reason OUT_OF_STOCK
//   - requested > stock                 -> capped at the stock, reason INSUFFICIENT_STOCK
//   - otherwise                         -> requested is used, no adjustment
// The merge never lowers a quantity that was already in the account cart (that line is
// flagged by GET /cart if the stock dropped later), so applied is never below existing.
//
// Adjustment shape agreed with the frontend (SCRUM-33 MergeNotice.jsx):
//   { productId, name, requested, applied, reason }
// applied = the quantity of that product in the cart after the merge.

// guestItems: [{ productId, quantity }]
// existing:   Map productId -> quantity already in the account cart
// products:   Map productId -> { name, stock, isActive }
// Returns { writes: [{ productId, quantity, isNew }], adjustments: [...] }
function planMerge(guestItems, existing, products) {
  const writes = [];
  const adjustments = [];

  for (const { productId, quantity } of guestItems) {
    const before = existing.get(productId) ?? 0;
    const requested = before + quantity;
    const product = products.get(productId);
    const adjust = (applied, reason) =>
      adjustments.push({ productId, name: product?.name ?? null, requested, applied, reason });

    if (!product || !product.isActive) {
      adjust(before, "PRODUCT_UNAVAILABLE");
      continue;
    }
    if (product.stock <= 0) {
      adjust(before, "OUT_OF_STOCK");
      continue;
    }

    const applied = Math.max(before, Math.min(requested, product.stock));
    if (applied > before) writes.push({ productId, quantity: applied, isNew: before === 0 });
    if (applied < requested) adjust(applied, "INSUFFICIENT_STOCK");
  }

  return { writes, adjustments };
}

module.exports = { planMerge };