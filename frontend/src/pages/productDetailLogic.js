// Pure product detail logic, quantity validation and R9 field checks (SCRUM-30).
// Pure functions without React/DOM dependencies for deterministic unit testing.

export const MAX_PURCHASE_QUANTITY = 999

/**
 * Validates quantity input according to positive integer bounds and current stock.
 */
export function validateQuantity(input, maxStock = null) {
  const num = typeof input === 'number' ? input : Number(String(input || '').trim())

  if (!Number.isInteger(num) || num < 1) {
    return {
      ok: false,
      value: 1,
      error: 'Quantity must be a positive whole number.',
    }
  }

  if (num > MAX_PURCHASE_QUANTITY) {
    return {
      ok: false,
      value: MAX_PURCHASE_QUANTITY,
      error: `Quantity cannot exceed ${MAX_PURCHASE_QUANTITY}.`,
    }
  }

  if (typeof maxStock === 'number') {
    if (maxStock <= 0) {
      return {
        ok: false,
        value: 0,
        error: 'This product is out of stock.',
      }
    }
    if (num > maxStock) {
      return {
        ok: false,
        value: maxStock,
        error: `Only ${maxStock} items left in stock.`,
      }
    }
  }

  return { ok: true, value: num }
}

/**
 * Extracts stock information consistently across API payload variations.
 */
export function getProductStock(product) {
  if (!product) {
    return { stock: 0, isOutOfStock: true, isLowStock: false }
  }

  const stock =
    typeof product.quantityInStock === 'number'
      ? product.quantityInStock
      : typeof product.stock === 'number'
        ? product.stock
        : null

  const isOutOfStock =
    product.inStock === false ||
    (typeof stock === 'number' && stock <= 0)

  const isLowStock = !isOutOfStock && typeof stock === 'number' && stock > 0 && stock <= 3

  return { stock, isOutOfStock, isLowStock }
}

/**
 * Calculates remaining allowed quantity that can be added to cart
 * given the quantity already in the user's cart.
 */
export function computeRemainingAllowed(product, cartQuantity = 0) {
  const { stock, isOutOfStock } = getProductStock(product)
  if (isOutOfStock) return 0
  if (stock === null) return MAX_PURCHASE_QUANTITY
  return Math.max(0, stock - Math.max(0, cartQuantity))
}

/**
 * Verifies that all mandatory R9 product fields are present.
 */
export function checkMandatoryFields(product) {
  if (!product) return false
  const fields = [
    'name',
    'model',
    'serialNumber',
    'description',
    'category',
    'price',
    'currency',
    'warrantyStatus',
    'distributor',
  ]
  return fields.every((f) => product[f] !== undefined && product[f] !== null && String(product[f]).trim() !== '')
}
