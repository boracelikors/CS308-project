// SCRUM-36: one invoice per paid order (R4, R17).
// The invoice copies the buyer and the delivery address at purchase time, so later
// profile edits never change an issued invoice. Line items are read from order_items,
// which are purchase-time snapshots that are never updated.

const EMAIL_STATUSES = ["pending", "sending", "sent", "failed"];

exports.up = async function (knex) {
  await knex.schema.createTable("invoices", (t) => {
    t.increments("id").primary();
    // UNIQUE: a paid order can never get a second invoice
    t.integer("order_id").unsigned().notNullable().unique("uq_invoices_order");
    t.string("invoice_number", 32).notNullable().unique("uq_invoices_number");
    t.dateTime("issued_at").notNullable().defaultTo(knex.fn.now());
    // Snapshots taken when the invoice is issued
    t.string("customer_name", 100).notNullable();
    t.string("customer_email", 254).notNullable();
    t.string("customer_tax_id", 11).nullable();
    t.string("delivery_address", 255).notNullable();
    t.decimal("total_price", 12, 2).notNullable();
    t.string("currency", 3).notNullable();
    // Email delivery state. Only an error code is stored, never message text.
    t.enu("email_status", EMAIL_STATUSES).notNullable().defaultTo("pending");
    t.integer("email_attempts").unsigned().notNullable().defaultTo(0);
    t.dateTime("email_last_attempt_at").nullable();
    t.dateTime("email_sent_at").nullable();
    t.string("email_last_error", 64).nullable();
    t.dateTime("created_at").notNullable().defaultTo(knex.fn.now());
    t.dateTime("updated_at")
      .notNullable()
      .defaultTo(knex.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));

    t.foreign("order_id", "fk_invoices_order").references("orders.id").onDelete("RESTRICT");
  });
  await knex.raw(`
    ALTER TABLE invoices
      ADD CONSTRAINT chk_invoices_total_nonnegative CHECK (total_price >= 0),
      ADD CONSTRAINT chk_invoices_sent_at CHECK (email_sent_at IS NULL OR email_status = 'sent')
  `);
};

exports.down = async function (knex) {
  await knex.schema.dropTable("invoices");
};

exports.EMAIL_STATUSES = EMAIL_STATUSES;