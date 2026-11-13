// GET /cart, POST /cart/items, PUT /cart/items/:productId, DELETE /cart/items/:productId (SCRUM-28)
// Customers only. The cart owner always comes from the login session, never from the request.
const express = require("express");
const { requireRole } = require("../auth/guards");
const cartStore = require("./cartStore");
const { CartError, CART_ERROR_STATUS } = cartStore;
const { mergeGuestCart, MergeKeyReused } = require("./cartMerge");
const { validateMerge, requestHash } = require("./validateMerge");

// "12" -> 12; anything else -> null
function parseProductId(value) {
  if (Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^[1-9]\d{0,9}$/.test(value)) return Number(value);
  return null;
}

function sendCartError(res, err) {
  const error = { code: err.code, message: err.message };
  if (err.available !== undefined) error.available = err.available;
  return res.status(CART_ERROR_STATUS[err.code]).json({ error });
}

// store is injectable so the HTTP tests can run without a database
function createCartRouter({ db, store = bindStore(db) }) {
  const router = express.Router();
  router.use(requireRole("customer")); // 401 for guests, 403 for staff accounts

  // Runs a store call and answers with the cart, or with the matching cart error
  const handle = (run) => async (req, res, next) => {
    try {
      const cart = await run(req, req.session.user.id);
      return res.json({ cart });
    } catch (err) {
      if (err instanceof CartError) return sendCartError(res, err);
      return next(err);
    }
  };

  router.get("/", handle((req, userId) => store.getCart(userId)));

  router.post("/items", (req, res, next) => {
    const productId = parseProductId(req.body?.productId);
    if (productId === null) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Some fields are invalid.",
          fields: { productId: "productId must be a positive whole number." },
        },
      });
    }
    return handle((r, userId) => store.addItem(userId, productId, req.body?.quantity))(req, res, next);
  });

  router.put(
    "/items/:productId",
    handle((req, userId) => {
      const productId = parseProductId(req.params.productId);
      if (productId === null) {
        throw new CartError("CART_ITEM_NOT_FOUND", "This product is not in your cart.");
      }
      return store.setItemQuantity(userId, productId, req.body?.quantity);
    })
  );

  router.delete(
    "/items/:productId",
    handle((req, userId) => {
      const productId = parseProductId(req.params.productId);
      return productId === null ? store.getCart(userId) : store.removeItem(userId, productId);
    })
  );
  // POST /cart/merge { requestKey, items: [{ productId, quantity }] } (SCRUM-32)
  // Adds the guest cart after login. The same requestKey is applied at most once.
  router.post("/merge", async (req, res) => {
    const parsed = validateMerge(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Some fields are invalid.", fields: parsed.fields },
      });
    }
    const { requestKey, items } = parsed.value;
    try {
      const result = await store.mergeGuestCart(req.session.user.id, {
        requestKey,
        items,
        hash: requestHash(items),
      });
      return res.json(result);
    } catch (err) {
      if (err instanceof MergeKeyReused) {
        return res.status(422).json({ error: { code: err.code, message: err.message } });
      }
      throw err; // Express 5 passes it to the error handler -> 500
    }
  });

  return router;
}

function bindStore(db) {
  return {
    getCart: (userId) => cartStore.getCart(db, userId),
    addItem: (userId, productId, quantity) => cartStore.addItem(db, userId, productId, quantity),
    setItemQuantity: (userId, productId, quantity) =>
    cartStore.setItemQuantity(db, userId, productId, quantity),
    removeItem: (userId, productId) => cartStore.removeItem(db, userId, productId),
    mergeGuestCart: (userId, input) => mergeGuestCart(db, userId, input),
  };
}

module.exports = { createCartRouter, parseProductId };
