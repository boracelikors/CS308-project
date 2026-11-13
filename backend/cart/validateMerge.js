// Input checks for POST /cart/merge (guest cart -> account cart after login).
// Pure functions: no database, so every rule is unit-tested in test/validateMerge.test.js.
//
// Body agreed with the frontend (SCRUM-33, frontend/src/cart/cartAdapters.js):
//   { requestKey, items: [{ productId, quantity }] }
// Anything else in the body (for example client prices or totals) is ignored.
const crypto = require("node:crypto");

// Same key rule as POST /checkout: the frontend sends crypto.randomUUID()
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_ITEMS = 50;
const MAX_QUANTITY = 999;

const isPositiveInt = (value, max) => Number.isInteger(value) && value >= 1 && value <= max;

// Returns { ok: true, value: { requestKey, items } } or { ok: false, fields }.
// items in value are sorted by productId; a product listed twice is merged into one line.
function validateMerge(body) {
  const input = body && typeof body === "object" ? body : {};
  const fields = {};

  if (typeof input.requestKey !== "string" || !KEY_PATTERN.test(input.requestKey)) {
    fields.requestKey = "requestKey must be 8-64 letters, digits, - or _ (e.g. a UUID).";
  }

  const rawItems = input.items;
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > MAX_ITEMS) {
    fields.items = `items must be a list of 1-${MAX_ITEMS} products.`;
  } else {
    const bad = rawItems.findIndex(
      (item) =>
        !item ||
        typeof item !== "object" ||
        !isPositiveInt(item.productId, Number.MAX_SAFE_INTEGER) ||
        !isPositiveInt(item.quantity, MAX_QUANTITY)
    );
    if (bad !== -1) {
      fields.items =
        `items[${bad}] needs a productId (positive whole number) and a quantity from 1 to ${MAX_QUANTITY}.`;
    }
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };

  const totals = new Map();
  for (const { productId, quantity } of rawItems) {
    totals.set(productId, (totals.get(productId) ?? 0) + quantity);
  }
  const items = [...totals]
    .sort(([a], [b]) => a - b)
    .map(([productId, quantity]) => ({ productId, quantity: Math.min(quantity, MAX_QUANTITY) }));

  return { ok: true, value: { requestKey: input.requestKey, items } };
}

// SHA-256 of the normalized items. A retry with the same key must send the same items;
// order and duplicate lines do not matter because the items are already normalized.
function requestHash(items) {
  return crypto.createHash("sha256").update(JSON.stringify(items)).digest("hex");
}

module.exports = { KEY_PATTERN, MAX_ITEMS, MAX_QUANTITY, validateMerge, requestHash };