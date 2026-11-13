// Order reads and delivery status changes (SCRUM-35).
// Customer functions always filter by the customer ID from the session, so another
// customer's order looks exactly like a missing one (404, nothing revealed).
const { orderView } = require("../checkout/checkoutService");
const { toMinorUnits, formatMinorUnits } = require("../cart/cartMath");

class OrderError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    Object.assign(this, extra);
  }
}

const ORDER_ERROR_STATUS = {
  ORDER_NOT_FOUND: 404,
  INVALID_STATUS_TRANSITION: 409,
};

// Same values as the orders.status ENUM (migration 20261110000004)
const ORDER_STATUSES = ["processing", "in_transit", "delivered"];

// The only allowed moves: processing -> in_transit -> delivered (R12)
const NEXT_STATUS = { processing: "in_transit", in_transit: "delivered" };
// Timestamp column written when an order reaches a status
const STATUS_TIME_COLUMN = { in_transit: "in_transit_at", delivered: "delivered_at" };

// Pure check, used by the store and the unit tests
function canMoveTo(current, requested) {
  return NEXT_STATUS[current] === requested;
}

// Newest first, summary only (the list page needs nothing else)
async function listCustomerOrders(db, customerId) {
  const rows = await db("orders")
    .where({ customer_id: customerId })
    .orderBy([{ column: "created_at", order: "desc" }, { column: "id", order: "desc" }])
    .select("id", "created_at", "total_price", "currency", "status");
  return rows.map((o) => ({
    id: o.id,
    createdAt: o.created_at,
    total: o.total_price,
    currency: o.currency,
    status: o.status,
  }));
}

async function loadOrder(q, where) {
  const order = await q("orders").where(where).first();
  if (!order) return null;
  const items = await q("order_items").where({ order_id: order.id }).orderBy("id");
  return orderView(order, items);
}

// Returns the order only if it belongs to this customer
async function getCustomerOrder(db, customerId, orderId) {
  const order = await loadOrder(db, { id: orderId, customer_id: customerId });
  if (!order) throw new OrderError("ORDER_NOT_FOUND", "Order not found.");
  return order;
}

// R12 delivery list for product managers: one row per order item.
// Only the fields the spec lists; no customer name, email or tax ID.
async function listDeliveries(db, { status } = {}) {
  let query = db("order_items as oi")
    .join("orders as o", "o.id", "oi.order_id")
    .orderBy([{ column: "o.created_at", order: "asc" }, { column: "oi.id", order: "asc" }])
    .select(
      "oi.id as deliveryId",
      "o.id as orderId",
      "o.customer_id as customerId",
      "oi.product_id as productId",
      "oi.product_name as productName",
      "oi.quantity",
      "oi.unit_price as unitPrice",
      "o.currency",
      "o.delivery_address as deliveryAddress",
      "o.status",
      "o.created_at as orderedAt"
    );
  if (status) query = query.where("o.status", status);
  const rows = await query;
  return rows.map(({ unitPrice, ...row }) => ({
    ...row,
    totalPrice: formatMinorUnits(toMinorUnits(unitPrice) * row.quantity),
    completed: row.status === "delivered",
  }));
}

// Moves an order one step forward and records when it happened.
// The UPDATE only matches if the status is still the one we read, so two managers
// clicking at the same time cannot skip a step or apply it twice.
async function advanceStatus(db, orderId, requested) {
  const order = await db("orders").where({ id: orderId }).first("status");
  if (!order) throw new OrderError("ORDER_NOT_FOUND", "Order not found.");
  if (!canMoveTo(order.status, requested)) {
    throw new OrderError(
      "INVALID_STATUS_TRANSITION",
      `An order that is ${order.status} cannot be moved to ${requested}.`,
      { currentStatus: order.status }
    );
  }
  const changed = await db("orders")
    .where({ id: orderId, status: order.status })
    .update({ status: requested, [STATUS_TIME_COLUMN[requested]]: db.fn.now() });
  if (changed !== 1) {
    const now = await db("orders").where({ id: orderId }).first("status");
    throw new OrderError("INVALID_STATUS_TRANSITION", "The order status was changed by someone else. Reload and try again.", {
      currentStatus: now?.status,
    });
  }
  return loadOrder(db, { id: orderId });
}

module.exports = {
  OrderError,
  ORDER_ERROR_STATUS,
  ORDER_STATUSES,
  NEXT_STATUS,
  canMoveTo,
  listCustomerOrders,
  getCustomerOrder,
  listDeliveries,
  advanceStatus,
};
