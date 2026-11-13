// Stores the adjustments of a guest-cart merge with its request key (POST /cart/merge).
// A retry with the same key gets the first adjustments back instead of an empty list,
// so the customer still sees which products were reduced or not added.
exports.up = async function (knex) {
  await knex.schema.alterTable("cart_merge_requests", (t) => {
    t.json("response_body").nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("cart_merge_requests", (t) => {
    t.dropColumn("response_body");
  });
};