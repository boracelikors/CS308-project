const PUBLIC_LIMIT = 20;
const QUEUE_LIMIT = 50;

const activeProduct = (db, id) =>
  db("products").where({ id, is_active: true }).first("id");

async function hasDeliveredPurchase(db, customerId, productId) {
  const order = await db("orders as o")
    .join("order_items as i", "i.order_id", "o.id")
    .where({ "o.customer_id": customerId, "o.status": "delivered", "i.product_id": productId })
    .whereNotNull("o.delivered_at")
    .first("o.id");
  return Boolean(order);
}

async function publicReviews(db, productId) {
  const [ratings, comments] = await Promise.all([
    db("product_ratings").where({ product_id: productId }).count({ count: "*" }).avg({ average: "score" }).first(),
    db("product_comments").where({ product_id: productId, status: "approved" })
      .select("id", "body", "submitted_at as submittedAt")
      .orderBy("submitted_at", "desc").orderBy("id", "desc").limit(PUBLIC_LIMIT),
  ]);
  return { rating: { count: Number(ratings.count), average: ratings.average === null ? null : Number(ratings.average) }, comments };
}

async function ownReview(db, customerId, productId) {
  const where = { customer_id: customerId, product_id: productId };
  const [eligible, rating, comment] = await Promise.all([
    hasDeliveredPurchase(db, customerId, productId),
    db("product_ratings").where(where).first("score"),
    db("product_comments").where(where).first("body", "status"),
  ]);
  return { eligible, rating: rating?.score ?? null, comment: comment ?? null };
}

async function saveRating(db, customerId, productId, score) {
  await db("product_ratings")
    .insert({ customer_id: customerId, product_id: productId, score })
    .onConflict(["product_id", "customer_id"]).merge({ score });
}

async function saveComment(db, customerId, productId, body) {
  await db("product_comments")
    .insert({ customer_id: customerId, product_id: productId, body })
    .onConflict(["product_id", "customer_id"])
    .merge({
      // Preserve moderation on a retry with identical text. MySQL evaluates these
      // assignments left to right, so compare the old body before replacing it.
      status: db.raw("IF(BINARY ?? = BINARY ?, ??, ?)", ["body", body, "status", "pending"]),
      revision: db.raw("IF(BINARY ?? = BINARY ?, ??, ?? + 1)", ["body", body, "revision", "revision"]),
      submitted_at: db.raw("IF(BINARY ?? = BINARY ?, ??, CURRENT_TIMESTAMP)", ["body", body, "submitted_at"]),
      body,
    });
  return db("product_comments").where({ customer_id: customerId, product_id: productId }).first("body", "status");
}

function pendingComments(db) {
  return db("product_comments as c")
    .join("products as p", "p.id", "c.product_id")
    .join("users as u", "u.id", "c.customer_id")
    .where("c.status", "pending")
    .select("c.id", "c.body", "c.revision", "c.submitted_at as submittedAt",
      "p.id as productId", "p.name as productName", "u.name as authorName")
    .orderBy("c.submitted_at").orderBy("c.id").limit(QUEUE_LIMIT);
}

async function moderateComment(db, id, revision, status) {
  const changed = await db("product_comments").where({ id, revision, status: "pending" }).update({ status });
  if (changed === 1) return "saved";
  return await db("product_comments").where({ id }).first("id") ? "changed" : "missing";
}

module.exports = { activeProduct, hasDeliveredPurchase, publicReviews, ownReview, saveRating, saveComment, pendingComments, moderateComment };
