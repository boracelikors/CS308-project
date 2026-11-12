// Guest cart persistence in localStorage.
// Only product IDs and quantities are stored: no prices, no account data, no credentials.
import { normalizeLines } from './cartLogic.js'

export const GUEST_CART_KEY = 'dobby.guestCart'
// Bump when the stored shape changes; older data is then discarded instead of misread
export const GUEST_CART_VERSION = 1

// localStorage can be missing or throw (private mode, blocked site data)
export function browserStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

// Returns valid lines, or [] for missing, malformed or old-version data. Never throws.
export function loadGuestCart(storage = browserStorage()) {
  let raw
  try {
    raw = storage?.getItem(GUEST_CART_KEY)
  } catch {
    return []
  }
  if (raw === null || raw === undefined) return []

  let data
  try {
    data = JSON.parse(raw)
  } catch {
    data = null
  }
  if (data?.version !== GUEST_CART_VERSION || !Array.isArray(data.items)) {
    clearGuestCart(storage)
    return []
  }
  return normalizeLines(data.items)
}

export function saveGuestCart(lines, storage = browserStorage()) {
  const items = lines.map(({ productId, quantity }) => ({ productId, quantity }))
  try {
    storage?.setItem(GUEST_CART_KEY, JSON.stringify({ version: GUEST_CART_VERSION, items }))
  } catch {
    // Storage full or blocked: the cart still works for this page visit
  }
}

export function clearGuestCart(storage = browserStorage()) {
  try {
    storage?.removeItem(GUEST_CART_KEY)
  } catch {
    // Nothing to clean up if storage is unavailable
  }
}
