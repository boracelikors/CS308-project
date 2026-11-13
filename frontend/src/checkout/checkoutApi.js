import { apiRequest } from '../api/request.js'

// POST /checkout (SCRUM-34, backend PR #22; the README has every error code):
//   POST /checkout   (customer session)
//   { requestKey, expectedTotal, deliveryAddress,
//     payment: { cardholderName, cardNumber, expiryMonth, expiryYear, cvc } }
//   201 { order: { id, status, createdAt, deliveryAddress, total, currency, cardLast4,
//                  items: [{ productId, productName, unitPrice, quantity, lineTotal }] } }
//   402 PAYMENT_DECLINED · 409 CART_CHANGED (prices/stock/total changed) · 400 EMPTY_CART
//   400 VALIDATION_ERROR { fields } · 401/403 not a customer session
//   409 OUT_OF_STOCK (last unit sold meanwhile) · 422 REQUEST_KEY_REUSED (start a new attempt)
//   503 CHECKOUT_IN_PROGRESS (same key still running: retry with the same key and body)
//   The same key with the same body returns the first response again (checkout_requests).
export function submitCheckout(requestKey, body) {
  return apiRequest('/checkout', { method: 'POST', body: { requestKey, ...body } })
}

export function resolveCheckout(requestKey) { return apiRequest(`/checkout/attempts/${encodeURIComponent(requestKey)}/resolve`, {method:'POST'}) }
