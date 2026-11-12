// POST /checkout (SCRUM-34). Customers only; the cart and the buyer always come from the
// login session, never from the request body. Card data is used for the mock bank call
// only and is never stored or logged.
const express = require("express");
const { requireRole } = require("../auth/guards");
const { validateCheckout } = require("./validateCheckout");
const checkoutService = require("./checkoutService");

// service and hooks are injectable for tests
function createCheckoutRouter({ db, bank, service = checkoutService, hooks = {} }) {
  const router = express.Router();
  router.use(requireRole("customer")); // 401 for guests, 403 for staff accounts

  router.post("/", async (req, res, next) => {
    const checked = validateCheckout(req.body);
    if (!checked.ok) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Some fields are invalid.", fields: checked.fields },
      });
    }
    try {
      const result = await service.checkout(db, bank, {
        userId: req.session.user.id,
        key: checked.value.requestKey,
        input: checked.value,
        hooks,
      });
      if (result.replayed) res.set("Idempotent-Replayed", "true");
      return res.status(result.status).json(result.body);
    } catch (err) {
      // Only the error code/type is logged: a message could contain request data
      return next(new Error(`Checkout failed: ${err.code || err.name}`));
    }
  });

  return router;
}

module.exports = { createCheckoutRouter };
