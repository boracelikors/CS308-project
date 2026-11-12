// Order tracking and delivery workflow (SCRUM-35).
//   GET   /orders              customer: own orders, newest first
//   GET   /orders/:id          customer: one own order (404 for missing AND for others' orders)
//   PATCH /orders/:id/status   product manager: processing -> in_transit -> delivered
//   GET   /deliveries          product manager: R12 delivery list (?status= optional)
// Customer routes take the customer ID from the session only, never from the request.
const express = require("express");
const { requireRole } = require("../auth/guards");
const orderStore = require("./orderStore");
const { OrderError, ORDER_ERROR_STATUS, ORDER_STATUSES } = orderStore;

// "12" -> 12; anything else -> null
function parseOrderId(value) {
  return typeof value === "string" && /^[1-9]\d{0,9}$/.test(value) ? Number(value) : null;
}

function sendOrderError(res, err) {
  const error = { code: err.code, message: err.message };
  if (err.currentStatus !== undefined) error.currentStatus = err.currentStatus;
  return res.status(ORDER_ERROR_STATUS[err.code]).json({ error });
}

const notFound = (res) => res.status(404).json({ error: { code: "ORDER_NOT_FOUND", message: "Order not found." } });

function validationError(res, fields) {
  return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Some fields are invalid.", fields } });
}

// Runs a store call; known order errors become their status, the rest go to errorHandler
const handle = (run) => async (req, res, next) => {
  try {
    return await run(req, res);
  } catch (err) {
    if (err instanceof OrderError) return sendOrderError(res, err);
    return next(err);
  }
};

// store is injectable so the HTTP tests can run without a database
function createOrderRouter({ db, store = bindStore(db) }) {
  const router = express.Router();
  const customerOnly = requireRole("customer");
  const managerOnly = requireRole("product_manager");

  router.get(
    "/",
    customerOnly,
    handle(async (req, res) => res.json({ orders: await store.listCustomerOrders(req.session.user.id) }))
  );

  router.get(
    "/:id",
    customerOnly,
    handle(async (req, res) => {
      const orderId = parseOrderId(req.params.id);
      if (orderId === null) return notFound(res);
      return res.json({ order: await store.getCustomerOrder(req.session.user.id, orderId) });
    })
  );

  router.patch(
    "/:id/status",
    managerOnly,
    handle(async (req, res) => {
      const orderId = parseOrderId(req.params.id);
      if (orderId === null) return notFound(res);
      const status = req.body?.status;
      if (!["in_transit", "delivered"].includes(status)) {
        return validationError(res, { status: 'status must be "in_transit" or "delivered".' });
      }
      return res.json({ order: await store.advanceStatus(orderId, status) });
    })
  );

  return router;
}

function createDeliveryRouter({ db, store = bindStore(db) }) {
  const router = express.Router();
  router.use(requireRole("product_manager"));

  router.get(
    "/",
    handle(async (req, res) => {
      const { status } = req.query;
      if (status !== undefined && !ORDER_STATUSES.includes(status)) {
        return validationError(res, { status: `status must be one of: ${ORDER_STATUSES.join(", ")}.` });
      }
      return res.json({ deliveries: await store.listDeliveries({ status }) });
    })
  );

  return router;
}

function bindStore(db) {
  return {
    listCustomerOrders: (customerId) => orderStore.listCustomerOrders(db, customerId),
    getCustomerOrder: (customerId, orderId) => orderStore.getCustomerOrder(db, customerId, orderId),
    listDeliveries: (filter) => orderStore.listDeliveries(db, filter),
    advanceStatus: (orderId, status) => orderStore.advanceStatus(db, orderId, status),
  };
}

module.exports = { createOrderRouter, createDeliveryRouter, parseOrderId };
