// Pure guest cart rules. No React, no storage, no network, so it can be unit tested.
// A cart "line" is only { productId, quantity }; prices and stock always come from
// the latest product data, never from the line itself.

// Upper bound for one line, so a corrupted or hand-edited cart cannot hold huge numbers
export const MAX_LINE_QUANTITY = 999

export class CartActionError extends Error {
  constructor(code, message, extra = {}) {
    super(message)
    this.code = code
    Object.assign(this, extra)
  }
}

function isProductId(value) {
  return Number.isInteger(value) && value > 0
}

function isLineQuantity(value) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_LINE_QUANTITY
}

// Keeps valid lines, merges duplicate products (quantities added, capped) and keeps first-seen order.
// Anything else (wrong types, negative numbers, extra fields such as prices) is dropped.
export function normalizeLines(raw) {
  if (!Array.isArray(raw)) return []
  const merged = new Map()
  for (const entry of raw) {
    const productId = entry?.productId
    const quantity = entry?.quantity
    if (!isProductId(productId) || !isLineQuantity(quantity)) continue
    const total = (merged.get(productId) ?? 0) + quantity
    merged.set(productId, Math.min(total, MAX_LINE_QUANTITY))
  }
  return [...merged].map(([productId, quantity]) => ({ productId, quantity }))
}

export function quantityOf(lines, productId) {
  return lines.find((line) => line.productId === productId)?.quantity ?? 0
}

export function countItems(lines) {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}

// Same codes and messages as the backend (cart/cartMath.js validateQuantity).
// stock is only checked when the product data includes it.
export function checkQuantity(quantity, product) {
  if (!product) {
    throw new CartActionError('PRODUCT_NOT_FOUND', 'This product does not exist.')
  }
  if (!isLineQuantity(quantity)) {
    throw new CartActionError(
      'INVALID_QUANTITY',
      `Quantity must be a whole number from 1 to ${MAX_LINE_QUANTITY}.`,
    )
  }
  const stock = product.stock
  if (typeof stock !== 'number') return
  if (stock <= 0) {
    throw new CartActionError('OUT_OF_STOCK', 'This product is out of stock.')
  }
  if (quantity > stock) {
    throw new CartActionError('INSUFFICIENT_STOCK', `Only ${stock} left in stock.`, { available: stock })
  }
}

// Adding a product that is already in the cart increases its quantity
export function addLine(lines, productId, quantity) {
  if (quantityOf(lines, productId) === 0) return [...lines, { productId, quantity }]
  return lines.map((line) =>
    line.productId === productId ? { productId, quantity: line.quantity + quantity } : line,
  )
}

export function setLineQuantity(lines, productId, quantity) {
  return lines.map((line) => (line.productId === productId ? { productId, quantity } : line))
}

export function removeLine(lines, productId) {
  return lines.filter((line) => line.productId !== productId)
}

// Money as integer kuruş, like the backend (cart/cartMath.js), so totals are exact.
// Accepts the JSON number 89900 and the MySQL DECIMAL string "18749.90".
export function toMinorUnits(value) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value ?? '').trim())
  if (!match) return null
  const minor = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(minor) ? minor : null
}

export function formatMinorUnits(minor) {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`
}

// Why a line cannot be bought right now, or null (same codes as backend lineProblem)
function lineProblem(product, unitMinor, quantity) {
  if (!product || unitMinor === null) return 'UNAVAILABLE'
  if (typeof product.stock !== 'number') return null
  if (product.stock <= 0) return 'OUT_OF_STOCK'
  if (quantity > product.stock) return 'INSUFFICIENT_STOCK'
  return null
}

// Builds the same shape as the backend GET /cart, so consumers do not care which mode is active.
// Lines with a problem are shown but not counted in the subtotal.
// The subtotal is for display only; the server recalculates it at checkout.
export function buildCartView(lines, productsById) {
  let subtotalMinor = 0
  let currency = null
  const items = lines.map(({ productId, quantity }) => {
    const product = productsById.get(productId)
    const unitMinor = product ? toMinorUnits(product.price) : null
    const problem = lineProblem(product, unitMinor, quantity)
    const lineMinor = unitMinor === null ? null : unitMinor * quantity
    if (problem === null) {
      subtotalMinor += lineMinor
      currency ??= product.currency ?? 'TRY'
    }
    return {
      productId,
      name: product?.name ?? null,
      image: product?.image ?? null,
      unitPrice: unitMinor === null ? null : formatMinorUnits(unitMinor),
      currency: product ? (product.currency ?? 'TRY') : null,
      quantity,
      lineTotal: lineMinor === null ? null : formatMinorUnits(lineMinor),
      stock: typeof product?.stock === 'number' ? product.stock : null,
      problem,
    }
  })
  return { items, subtotal: formatMinorUnits(subtotalMinor), currency }
}
