const { Router } = require("express");
const { requireRole } = require("../auth/guards");
const store = require("./reviewStore");

const MAX_ID = 4294967295;
function parseId(value) {
  if (typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value)) return null;
  const id = Number(value);
  return id <= MAX_ID ? id : null;
}
const validScore = (value) => Number.isInteger(value) && value >= 1 && value <= 5;
function parseComment(value) {
  if (typeof value !== "string") return null;
  const body = value.trim();
  return body && [...body].length <= 1000 ? body : null;
}
const validDecision = (status, revision) =>
  ["approved", "rejected"].includes(status) && Number.isSafeInteger(revision) && revision > 0 && revision <= MAX_ID;

function fail(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function createReviewRouter({ db }) {
  const router = Router();
  const customerOnly = requireRole("customer");
  const product = async (req, res, next) => {
    const id = parseId(req.params.productId);
    if (id === null || !(await store.activeProduct(db, id))) {
      return fail(res, 404, "PRODUCT_NOT_FOUND", "Product not found.");
    }
    res.locals.productId = id;
    return next();
  };
  const delivered = async (req, res, next) => {
    if (!(await store.hasDeliveredPurchase(db, req.session.user.id, res.locals.productId))) {
      return fail(res, 403, "REVIEW_NOT_ELIGIBLE", "You can review this product after your order is delivered.");
    }
    return next();
  };

  router.get("/:productId/reviews", product, async (_req, res) => {
    res.json(await store.publicReviews(db, res.locals.productId));
  });
  router.get("/:productId/reviews/me", customerOnly, product, async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(await store.ownReview(db, req.session.user.id, res.locals.productId));
  });
  router.put("/:productId/reviews/rating", customerOnly, product, delivered, async (req, res) => {
    const score = req.body?.score;
    if (!validScore(score)) return fail(res, 400, "VALIDATION_ERROR", "Choose a whole rating from 1 to 5.");
    await store.saveRating(db, req.session.user.id, res.locals.productId, score);
    return res.json({ score });
  });
  router.put("/:productId/reviews/comment", customerOnly, product, delivered, async (req, res) => {
    const body = parseComment(req.body?.body);
    if (body === null) return fail(res, 400, "VALIDATION_ERROR", "Enter a comment of 1 to 1000 characters.");
    return res.json(await store.saveComment(db, req.session.user.id, res.locals.productId, body));
  });
  return router;
}

function createModerationRouter({ db }) {
  const router = Router();
  router.use(requireRole("product_manager"));
  router.get("/", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ comments: await store.pendingComments(db) });
  });
  router.patch("/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return fail(res, 404, "COMMENT_NOT_FOUND", "Comment not found.");
    const { status, revision } = req.body ?? {};
    if (!validDecision(status, revision)) {
      return fail(res, 400, "VALIDATION_ERROR", "Choose approve or reject for the listed revision.");
    }
    const result = await store.moderateComment(db, id, revision, status);
    if (result === "missing") return fail(res, 404, "COMMENT_NOT_FOUND", "Comment not found.");
    if (result === "changed") return fail(res, 409, "COMMENT_CHANGED", "The comment changed. Refresh the queue.");
    return res.json({ id, status });
  });
  return router;
}

module.exports = { createReviewRouter, createModerationRouter, parseId, validScore, parseComment, validDecision };
