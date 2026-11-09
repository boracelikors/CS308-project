// SCRUM-20: accounts for all four roles (R10, R17).
// Customers must have a tax ID and home address; staff accounts may leave them empty.

const ROLES = ["customer", "sales_manager", "product_manager", "support_agent"];

exports.up = async function (knex) {
  await knex.schema.createTable("users", (t) => {
    t.increments("id").primary();
    t.string("name", 100).notNullable();
    // Stored lowercase and trimmed; unique index prevents duplicate accounts
    t.string("email", 254).notNullable().unique("uq_users_email");
    // bcrypt hash from auth/password.js (always 60 chars); never the plain password
    t.string("password_hash", 60).notNullable();
    t.enu("role", ROLES).notNullable().defaultTo("customer");
    t.string("tax_id", 11).nullable();
    t.string("home_address", 255).nullable();
    t.dateTime("created_at").notNullable().defaultTo(knex.fn.now());
    t.dateTime("updated_at")
      .notNullable()
      .defaultTo(knex.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));
  });

  await knex.raw(`
    ALTER TABLE users
      -- Binary comparison so "Ali@X.com" is rejected even with a case-insensitive collation
      ADD CONSTRAINT chk_users_email_normalized
        CHECK (CAST(email AS BINARY) = CAST(LOWER(TRIM(email)) AS BINARY)),
      ADD CONSTRAINT chk_users_name_not_blank CHECK (CHAR_LENGTH(TRIM(name)) > 0),
      ADD CONSTRAINT chk_users_tax_id_digits CHECK (tax_id IS NULL OR tax_id REGEXP '^[0-9]{10,11}$'),
      ADD CONSTRAINT chk_users_customer_profile
        CHECK (role <> 'customer' OR (tax_id IS NOT NULL AND home_address IS NOT NULL))
  `);
};

exports.down = async function (knex) {
  await knex.schema.dropTable("users");
};

exports.ROLES = ROLES;
