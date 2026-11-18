// Invoice storage and reads (SCRUM-36).
// An invoice is issued inside the checkout transaction (see checkout/checkoutService.js),
// so every paid order has exactly one. The UNIQUE order_id makes issuing safe to repeat.
const { invoiceNumber, lineTotal, sumLines } = require("./invoiceFormat");

// Creates the invoice of a paid order from its snapshots. Doing it again does nothing.
// q is a transaction during checkout, or the plain connection for older orders.
async function issueInvoice(q, orderId) {
  const order = await q("orders as o")
    .join("users as u", "u.id", "o.customer_id")
    .where("o.id", orderId)
    .first(
      "o.total_price",
      "o.currency",
      "o.delivery_address",
      "u.name",
      "u.email",
      "u.tax_id"
    );
  if (!order) throw new Error(`Cannot issue an invoice: order ${orderId} does not exist.`);

  // The printed lines must add up to the amount that was charged
  const items = await q("order_items").where({ order_id: orderId }).select("unit_price", "quantity");
  const itemsTotal = sumLines(items.map((it) => ({ unitPrice: it.unit_price, quantity: it.quantity })));
  if (itemsTotal !== order.total_price) {
    throw new Error(`Cannot issue an invoice: the items of order ${orderId} do not add up to its total.`);
  }

  const issuedAt = new Date();
  try {
    await q("invoices").insert({
      order_id: orderId,
      invoice_number: invoiceNumber(orderId, issuedAt),
      issued_at: issuedAt,
      customer_name: order.name,
      customer_email: order.email,
      customer_tax_id: order.tax_id,
      delivery_address: order.delivery_address,
      total_price: order.total_price,
      currency: order.currency,
    });
  } catch (err) {
    if (err.code !== "ER_DUP_ENTRY") throw err; // already issued: keep the first one
  }
}

function emailView(row) {
  return {
    status: row.email_status, // pending | sending | sent | failed
    attempts: row.email_attempts,
    lastAttemptAt: row.email_last_attempt_at,
    sentAt: row.email_sent_at,
    lastError: row.email_last_error, // a short code such as "ECONNREFUSED", or null
  };
}

function invoiceView(row, items) {
  return {
    number: row.invoice_number,
    orderId: row.order_id,
    orderedAt: row.ordered_at,
    issuedAt: row.issued_at,
    customer: { name: row.customer_name, email: row.customer_email, taxId: row.customer_tax_id },
    deliveryAddress: row.delivery_address,
    items: items.map((it) => ({
      productId: it.product_id,
      productName: it.product_name,
      productModel: it.product_model,
      unitPrice: it.unit_price, // purchase-time price, never today's catalogue price
      quantity: it.quantity,
      lineTotal: lineTotal(it.unit_price, it.quantity),
    })),
    total: row.total_price,
    currency: row.currency,
    email: emailView(row),
  };
}

async function loadInvoice(q, orderId) {
  const row = await q("invoices as i")
    .join("orders as o", "o.id", "i.order_id")
    .where("i.order_id", orderId)
    .first("i.*", "o.created_at as ordered_at");
  if (!row) return null;
  const items = await q("order_items").where({ order_id: orderId }).orderBy("id");
  return invoiceView(row, items);
}

async function loadEmailState(q, orderId) {
  const row = await q("invoices").where({ order_id: orderId }).first();
  return row ? emailView(row) : null;
}

// The invoice of an order this user may see, or null (missing and not-yours look the same).
// Customers see only their own orders; sales managers see every order.
async function findInvoiceFor(db, user, orderId) {
  const where = user.role === "customer" ? { id: orderId, customer_id: user.id } : { id: orderId };
  const order = await db("orders").where(where).first("id");
  if (!order) return null;

  const invoice = await loadInvoice(db, orderId);
  if (invoice) return invoice;
  // Orders paid before invoices existed get theirs on first request
  await issueInvoice(db, orderId);
  return loadInvoice(db, orderId);
}

module.exports = { issueInvoice, loadInvoice, loadEmailState, findInvoiceFor, invoiceView };