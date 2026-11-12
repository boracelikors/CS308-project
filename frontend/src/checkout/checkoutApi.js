import { apiRequest } from '../api/request.js'

// PROPOSED contract, to confirm with SCRUM-34 (not implemented in the backend yet):
//   POST /checkout   (customer session)
//   { requestKey, expectedTotal, deliveryAddress,
//     payment: { cardholderName, cardNumber, expiryMonth, expiryYear, cvc } }
//   201 { order: { id, status, createdAt, deliveryAddress, total, currency, cardLast4,
//                  items: [{ productId, productName, unitPrice, quantity, lineTotal }] } }
//   402 PAYMENT_DECLINED · 409 CART_CHANGED (prices/stock/total changed) · 400 EMPTY_CART
//   400 VALIDATION_ERROR { fields } · 401/403 not a customer session
//   The same key with the same body returns the first response again (checkout_requests).
export function submitCheckout(requestKey, body) {
  return apiRequest('/checkout', { method: 'POST', body: { requestKey, ...body } })
}
