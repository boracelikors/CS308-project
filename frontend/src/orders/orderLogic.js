// Order history rules shared by the list and detail pages (SCRUM-39)

// orders.status ENUM; transitions are made by product managers through the API (SCRUM-35)
export const ORDER_STATUS_LABELS = {
  processing: 'Processing',
  in_transit: 'In transit',
  delivered: 'Delivered',
}

export function statusLabel(status) {
  return ORDER_STATUS_LABELS[status] ?? 'Status unavailable'
}

// Delivery progress for the detail page: each step is done once the order reached it
export function deliverySteps({ status, createdAt, inTransitAt, deliveredAt }) {
  const reached = Object.keys(ORDER_STATUS_LABELS).indexOf(status)
  return [
    { status: 'processing', label: 'Order received', at: createdAt },
    { status: 'in_transit', label: 'In transit', at: inTransitAt },
    { status: 'delivered', label: 'Delivered', at: deliveredAt },
  ].map((step, index) => ({ ...step, done: reached >= index, current: reached === index }))
}

// How a failed load is shown: 'notFound' covers missing orders and other customers' orders
// (the API answers both with 404, so nothing reveals that another customer's order exists)
export function classifyLoadError(error) {
  if (error?.status === 404) return 'notFound'
  if (error?.status === 401 || error?.status === 403) return 'signedOut'
  return 'error'
}

// Order IDs from a URL segment: "12" -> 12; anything else -> null (shown as not found)
export function parseOrderId(value) {
  return typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) ? Number(value) : null
}
