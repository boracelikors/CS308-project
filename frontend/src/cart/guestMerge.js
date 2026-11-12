// Guest -> account cart merge after sign-in (SCRUM-33).
// The guest cart is cleared only after the server confirms the merge. Until then a
// "pending merge" record keeps the request key, so a retry, a double callback or a page
// refresh in the middle sends the same key and the server applies the merge at most once.
// The record holds only the user ID, the key and product IDs with quantities.
import { normalizeLines } from './cartLogic.js'
import { browserStorage, clearGuestCart, loadGuestCart } from './guestCartStorage.js'

export const PENDING_MERGE_KEY = 'dobby.guestCartMerge'
const PENDING_MERGE_VERSION = 1

function sameLines(a, b) {
  const key = (lines) => JSON.stringify([...lines].sort((x, y) => x.productId - y.productId))
  return key(a) === key(b)
}

export function loadPendingMerge(storage = browserStorage()) {
  let data = null
  try {
    const raw = storage?.getItem(PENDING_MERGE_KEY)
    if (raw === null || raw === undefined) return null
    data = JSON.parse(raw)
  } catch {
    // Malformed record: dropped below
  }
  const valid =
    data?.version === PENDING_MERGE_VERSION &&
    typeof data.requestKey === 'string' &&
    data.requestKey.length > 0 &&
    data.requestKey.length <= 64 &&
    (typeof data.userId === 'number' || typeof data.userId === 'string')
  if (!valid) {
    clearPendingMerge(storage)
    return null
  }
  return { userId: data.userId, requestKey: data.requestKey, items: normalizeLines(data.items) }
}

function savePendingMerge({ userId, requestKey, items }, storage) {
  try {
    storage?.setItem(PENDING_MERGE_KEY, JSON.stringify({ version: PENDING_MERGE_VERSION, userId, requestKey, items }))
  } catch {
    // Without storage the key still lives for this page visit
  }
}

export function clearPendingMerge(storage = browserStorage()) {
  try {
    storage?.removeItem(PENDING_MERGE_KEY)
  } catch {
    // Nothing to clean up if storage is unavailable
  }
}

// mergeRequest(requestKey, items) -> { cart, adjustments }; throws on failure
export function createGuestMerge({ mergeRequest, storage = browserStorage(), newRequestKey = () => crypto.randomUUID() }) {
  const inFlight = new Map() // userId -> promise, so a double callback sends one request

  async function mergeOnce(userId) {
    const items = loadGuestCart(storage)
    if (items.length === 0) {
      clearPendingMerge(storage)
      return { merged: false }
    }

    // Same customer and the same guest cart as last time: retry with the same key.
    // Anything else gets a new key (the server rejects one key with a different body).
    let pending = loadPendingMerge(storage)
    if (!pending || pending.userId !== userId || !sameLines(pending.items, items)) {
      pending = { userId, requestKey: newRequestKey(), items }
      savePendingMerge(pending, storage)
    }

    // On failure this throws and both the guest cart and the pending record are kept
    const result = await mergeRequest(pending.requestKey, pending.items)

    clearGuestCart(storage)
    clearPendingMerge(storage)
    return { merged: true, cart: result.cart, adjustments: result.adjustments ?? [] }
  }

  return {
    hasGuestItems: () => loadGuestCart(storage).length > 0,

    run(userId) {
      if (!inFlight.has(userId)) {
        inFlight.set(userId, mergeOnce(userId).finally(() => inFlight.delete(userId)))
      }
      return inFlight.get(userId)
    },
  }
}

// Human-readable text for one merge adjustment (shape: proposed SCRUM-32 contract)
export function describeAdjustment({ requested, applied, reason }) {
  if (reason === 'INSUFFICIENT_STOCK' && applied > 0) {
    return `Reduced from ${requested} to ${applied}: only ${applied} in stock.`
  }
  if (reason === 'OUT_OF_STOCK' || reason === 'INSUFFICIENT_STOCK') return 'Out of stock, so it was not added.'
  return 'No longer sold, so it was not added.'
}
