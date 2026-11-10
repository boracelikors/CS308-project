// SCRUM-20: orders, order items and checkout idempotency (R3, R12, R14, R17).
// Orders keep snapshots (address, names, unit prices) so later product or
// profile edits never change order history.

const ORDER_STATUSES = ["processing", "in_transit", "delivered"];
const CHECKOUT_STATUSES = ["pending", "succeeded", "declined", "failed"];

exports.up = async function (knex) {
  await knex.schema.createTable("orders", (t) => {
    t.increments("id").primary();
    t.integer("customer_id").unsigned().notNullable();
    t.enu("status", ORDER_STATUSES).notNullable().defaultTo("processing");
    t.decimal("total_price", 12, 2).notNullable();
    t.string("currency", 3).notNullable().defaultTo("TRY");
    // Snapshot of the address used for this order
    t.string("delivery_address", 255).notNullable();
    // Mock payment reference; full card number and CVV are never stored
    t.string("payment_reference", 64).notNullable().unique("uq_orders_payment_reference");
    t.string("payment_card_last4", 4).nullable();
    t.dateTime("created_at").notNullable().defaultTo(knex.fn.now());
    t.dateTime("updated_at")
      .notNullable()
      .defaultTo(knex.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));
    t.dateTime("in_transit_at").nullable();
    t.dateTime("delivered_at").nullable();

    t.foreign("customer_id", "fk_orders_customer").references("users.id").onDelete("RESTRICT");
    t.index(["customer_id", "created_at"], "idx_orders_customer_created");
    t.index(["status"], "idx_orders_status");
  });
  await knex.raw(`
    ALTER TABLE orders
      ADD CONSTRAINT chk_orders_total_nonnegative CHECK (total_price >= 0),
      ADD CONSTRAINT chk_orders_currency CHECK (currency = 'TRY'),
      ADD CONSTRAINT chk_orders_address_not_blank CHECK (CHAR_LENGTH(TRIM(delivery_address)) > 0),
      ADD CONSTRAINT chk_orders_card_last4 CHECK (payment_card_last4 IS NULL OR payment_card_last4 REGEXP '^[0-9]{4}$'),
      ADD CONSTRAINT chk_orders_delivered_at CHECK (delivered_at IS NULL OR status = 'delivered')
  `);

  await knex.schema.createTable("order_items", (t) => {
    t.increments("id").primary(); // also used as the delivery ID in the R12 delivery list
    t.integer("order_id").unsigned().notNullable();
    t.integer("product_id").unsigned().notNullable();
    // Snapshots taken at purchase time
    t.string("product_name", 150).notNullable();
    t.string("product_model", 100).notNullable();
    t.decimal("unit_price", 12, 2).notNullable(); // price actually paid (after any discount)
    t.integer("quantity").notNullable();

    t.foreign("order_id", "fk_order_items_order").references("orders.id").onDelete("RESTRICT");
    t.foreign("product_id", "fk_order_items_product").references("products.id").onDelete("RESTRICT");
    t.unique(["order_id", "product_id"], { indexName: "uq_order_items_order_product" });
  });
  await knex.raw(`
    ALTER TABLE order_items
      ADD CONSTRAINT chk_order_items_quantity_positive CHECK (quantity > 0),
      ADD CONSTRAINT chk_order_items_price_nonnegative CHECK (unit_price >= 0)
  `);

  // One row per (customer, Idempotency-Key). A retried POST /checkout returns
  // the stored result instead of paying or ordering twice (SCRUM-34).
  await knex.schema.createTable("checkout_requests", (t) => {
    t.increments("id").primary();
    t.integer("customer_id").unsigned().notNullable();
    t.string("request_key", 64).notNullable();
    // SHA-256 of the normalized request; same key + different input is rejected
    t.string("request_hash", 64).notNullable();
    t.enu("status", CHECKOUT_STATUSES).notNullable().defaultTo("pending");
    t.integer("order_id").unsigned().nullable().unique("uq_checkout_requests_order");
    t.smallint("response_status").unsigned().nullable();
    t.json("response_body").nullable();
    t.dateTime("created_at").notNullable().defaultTo(knex.fn.now());
    t.dateTime("updated_at")
      .notNullable()
      .defaultTo(knex.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));

    t.foreign("customer_id", "fk_checkout_requests_customer").references("users.id").onDelete("RESTRICT");
    t.foreign("order_id", "fk_checkout_requests_order").references("orders.id").onDelete("RESTRICT");
    t.unique(["customer_id", "request_key"], { indexName: "uq_checkout_requests_customer_key" });
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTable("checkout_requests");
  await knex.schema.dropTable("order_items");
  await knex.schema.dropTable("orders");
};

exports.ORDER_STATUSES = ORDER_STATUSES;
