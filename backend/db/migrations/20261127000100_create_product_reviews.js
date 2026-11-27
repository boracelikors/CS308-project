exports.up = async (db) => {
  await db.schema.createTable("product_ratings", (table) => {
    table.integer("product_id").unsigned().notNullable().references("products.id").onDelete("RESTRICT");
    table.integer("customer_id").unsigned().notNullable().references("users.id").onDelete("RESTRICT");
    table.integer("score").unsigned().notNullable();
    table.primary(["product_id", "customer_id"]);
  });
  await db.raw("ALTER TABLE product_ratings ADD CONSTRAINT chk_rating_score CHECK (score BETWEEN 1 AND 5)");

  await db.schema.createTable("product_comments", (table) => {
    table.increments("id");
    table.integer("product_id").unsigned().notNullable().references("products.id").onDelete("RESTRICT");
    table.integer("customer_id").unsigned().notNullable().references("users.id").onDelete("RESTRICT");
    table.string("body", 1000).notNullable();
    table.enu("status", ["pending", "approved", "rejected"]).notNullable().defaultTo("pending");
    table.integer("revision").unsigned().notNullable().defaultTo(1);
    table.dateTime("submitted_at").notNullable().defaultTo(db.fn.now());
    table.unique(["product_id", "customer_id"]);
    table.index(["product_id", "status", "submitted_at", "id"], "idx_comments_public");
    table.index(["status", "submitted_at", "id"], "idx_comments_queue");
  });
};

exports.down = async (db) => {
  await db.schema.dropTable("product_comments");
  await db.schema.dropTable("product_ratings");
};
