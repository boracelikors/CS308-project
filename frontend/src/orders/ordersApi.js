import { apiRequest } from '../api/request.js'

// Order endpoints (SCRUM-35, backend PR #23):
//   GET /orders       (customer session) -> 200 { orders: [{ id, createdAt, total, currency, status }] }, newest first
//   GET /orders/:id   -> 200 { order: { id, createdAt, status, inTransitAt, deliveredAt, total, currency,
//                                deliveryAddress,
//                                items: [{ productId, productName, productModel, unitPrice, quantity, lineTotal }] } }
//                     -> 404 ORDER_NOT_FOUND for a missing order and for another customer's order
// unitPrice is the purchase-time price from order_items, not the current catalogue price.

export function fetchOrders(signal) {
  return apiRequest('/orders', { signal }).then((data) => data.orders)
}

export function fetchOrder(orderId, signal) {
  return apiRequest(`/orders/${orderId}`, { signal }).then((data) => data.order)
}
