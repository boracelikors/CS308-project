// SCRUM-20: persistent account carts (R4).
// Guest carts live in the browser and are merged after login.
// No totals are stored: prices are always re-read from products.

exports.up = async function (knex) {
  await knex.schema.createTable("carts", (t) => {
    t.increments("id").primary();
    // One cart per account
    t.integer("user_id").unsigned().notNullable().unique("uq_carts_user");
    t.dateTime("created_at").notNullable().defaultTo(knex.fn.now());
    t.dateTime("updated_at")
      .notNullable()
      .defaultTo(knex.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));

    t.foreign("user_id", "fk_carts_user").references("users.id").onDelete("CASCADE");
  });

  await knex.schema.createTable("cart_items", (t) => {
    t.increments("id").primary();
    t.integer("cart_id").unsigned().notNullable();
    t.integer("product_id").unsigned().notNullable();
    t.integer("quantity").notNullable();
    t.dateTime("created_at").notNullable().defaultTo(knex.fn.now());
    t.dateTime("updated_at")
      .notNullable()
      .defaultTo(knex.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));

    t.foreign("cart_id", "fk_cart_items_cart").references("carts.id").onDelete("CASCADE");
    t.foreign("product_id", "fk_cart_items_product").references("products.id").onDelete("RESTRICT");
    // A product appears once per cart; adding again increases quantity
    t.unique(["cart_id", "product_id"], { indexName: "uq_cart_items_cart_product" });
  });
  await knex.raw(
    "ALTER TABLE cart_items ADD CONSTRAINT chk_cart_items_quantity_positive CHECK (quantity > 0)"
  );

  // Retry safety for guest-cart merge after login: the same request key
  // from the same user is applied once (owner: SCRUM-28/merge endpoint).
  await knex.schema.createTable("cart_merge_requests", (t) => {
    t.increments("id").primary();
    t.integer("user_id").unsigned().notNullable();
    t.string("request_key", 64).notNullable();
    // SHA-256 of the normalized request body; a reused key with different input is rejected
    t.string("request_hash", 64).notNullable();
    t.dateTime("created_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("user_id", "fk_cart_merge_requests_user").references("users.id").onDelete("CASCADE");
    t.unique(["user_id", "request_key"], { indexName: "uq_cart_merge_requests_user_key" });
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTable("cart_merge_requests");
  await knex.schema.dropTable("cart_items");
  await knex.schema.dropTable("carts");
};
