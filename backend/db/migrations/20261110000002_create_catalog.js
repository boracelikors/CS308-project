// SCRUM-20: categories and products with every R9 field.
// category/image are kept because the Sprint 1 product cards use them.

exports.up = async function (knex) {
  await knex.schema.createTable("categories", (t) => {
    t.increments("id").primary();
    t.string("name", 100).notNullable().unique("uq_categories_name");
    t.dateTime("created_at").notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("products", (t) => {
    t.increments("id").primary();
    t.integer("category_id").unsigned().notNullable();
    t.string("name", 150).notNullable();
    t.string("model", 100).notNullable();
    t.string("serial_number", 100).notNullable().unique("uq_products_serial_number");
    t.text("description").notNullable();
    t.integer("quantity_in_stock").notNullable().defaultTo(0);
    // DECIMAL keeps prices exact (no floating-point rounding)
    t.decimal("price", 12, 2).notNullable();
    t.string("currency", 3).notNullable().defaultTo("TRY");
    t.string("warranty_status", 100).notNullable();
    t.string("distributor", 150).notNullable();
    // Filename resolved by the frontend as /images/<image>
    t.string("image", 255).notNullable();
    // false = removed from sale; kept for order history instead of being deleted
    t.boolean("is_active").notNullable().defaultTo(true);
    t.dateTime("created_at").notNullable().defaultTo(knex.fn.now());
    t.dateTime("updated_at")
      .notNullable()
      .defaultTo(knex.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));

    t.foreign("category_id", "fk_products_category")
      .references("categories.id")
      .onDelete("RESTRICT");
    t.index(["category_id"], "idx_products_category");
    t.index(["price"], "idx_products_price"); // sort by price (R7)
    t.index(["name"], "idx_products_name");
    t.index(["is_active"], "idx_products_is_active");
  });

  await knex.raw(`
    ALTER TABLE products
      ADD CONSTRAINT chk_products_stock_nonnegative CHECK (quantity_in_stock >= 0),
      ADD CONSTRAINT chk_products_price_nonnegative CHECK (price >= 0),
      -- The store uses one currency (team decision, Sprint 1)
      ADD CONSTRAINT chk_products_currency CHECK (currency = 'TRY'),
      ADD CONSTRAINT chk_products_name_not_blank CHECK (CHAR_LENGTH(TRIM(name)) > 0)
  `);
  // Name/description keyword search (R7)
  await knex.raw("ALTER TABLE products ADD FULLTEXT INDEX ftx_products_search (name, description)");
};

exports.down = async function (knex) {
  await knex.schema.dropTable("products");
  await knex.schema.dropTable("categories");
};
