import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CartContext } from './cartContext.js'
import { createGuestCart, createServerCart } from './cartAdapters.js'
import { countItems } from './cartLogic.js'
import { loadGuestCart } from './guestCartStorage.js'
import { createGuestMerge } from './guestMerge.js'

const EMPTY_VIEW = { items: [], subtotal: '0.00', currency: null }
const NO_MERGE = { status: 'none', error: null, guestItemCount: 0 }
const LOADING = { status: 'loading', view: EMPTY_VIEW, error: null, merge: NO_MERGE, adjustments: [] }

function customerIdOf(user) {
  return user?.role === 'customer' ? user.id : null
}

// Logged-in customers use their server cart; guests (and staff, who cannot buy) use the browser cart.
// The user ID is part of the key, so switching customers always starts a new, empty cart state.
function accountKeyFor(user) {
  const customerId = customerIdOf(user)
  return customerId === null ? 'guest' : `customer:${customerId}`
}

// CartActionError (guest rules) and ApiError (server) both carry a code and message
function toCartError(error) {
  if (typeof error?.code === 'string') {
    const { code, message, available } = error
    return available === undefined ? { code, message } : { code, message, available }
  }
  console.error(error)
  return { code: 'NETWORK_ERROR', message: 'The cart could not be reached. Please try again.' }
}

// Merges the browser's guest cart into the customer's account cart (SCRUM-33).
// Returns a state patch; a failed merge keeps the guest cart and still shows the account cart.
async function mergeThenLoad(merger, adapter, customerId) {
  try {
    const result = await merger.run(customerId)
    if (result.merged) {
      return { view: result.cart, merge: { ...NO_MERGE, status: 'merged' }, adjustments: result.adjustments }
    }
  } catch (error) {
    const failed = { status: 'failed', error: toCartError(error), guestItemCount: countItems(loadGuestCart()) }
    return { view: await adapter.load(), merge: failed, adjustments: [] }
  }
  return { view: await adapter.load(), merge: NO_MERGE, adjustments: [] }
}

// user: { id, role } from GET /auth/me, or null for a guest
export default function CartProvider({ user = null, children }) {
  const accountKey = accountKeyFor(user)
  const customerId = customerIdOf(user)
  const [state, setState] = useState({ accountKey, ...LOADING })
  const [merger] = useState(() =>
    createGuestMerge({ mergeRequest: (requestKey, items) => createServerCart().merge(requestKey, items) }),
  )
  const adapterRef = useRef(null)
  const queueRef = useRef(Promise.resolve())

  useEffect(() => {
    const adapter = customerId === null ? createGuestCart() : createServerCart()
    adapterRef.current = adapter
    queueRef.current = Promise.resolve()

    // After sign-in, a non-empty guest cart is merged before the account cart is shown
    const start =
      customerId !== null && merger.hasGuestItems()
        ? mergeThenLoad(merger, adapter, customerId)
        : adapter.load().then((view) => ({ view }))

    start.then(
      (patch) => {
        if (adapterRef.current === adapter) setState({ accountKey, ...LOADING, status: 'ready', ...patch })
      },
      (error) => {
        if (adapterRef.current === adapter) setState({ accountKey, ...LOADING, status: 'error', error: toCartError(error) })
      },
    )
    return () => {
      adapterRef.current = null
    }
  }, [accountKey, customerId, merger])

  // Actions run one at a time, so a slow response cannot overwrite a newer one.
  // Results from a previous account's adapter are ignored.
  // An action resolves with a state patch such as { view }.
  const run = useCallback((action) => {
    const adapter = adapterRef.current
    if (!adapter) {
      return Promise.resolve({ ok: false, code: 'CART_NOT_READY', message: 'The cart is still loading.' })
    }
    const result = queueRef.current.then(() => action(adapter)).then(
      (patch) => {
        if (adapterRef.current === adapter) setState((s) => ({ ...s, status: 'ready', error: null, ...patch }))
        return { ok: true }
      },
      (error) => {
        const cartError = toCartError(error)
        if (adapterRef.current === adapter) setState((s) => ({ ...s, error: cartError }))
        return { ok: false, ...cartError }
      },
    )
    queueRef.current = result
    return result
  }, [])

  // Until the new account's cart has loaded, show nothing rather than the previous account's cart
  const current = state.accountKey === accountKey ? state : LOADING

  const value = useMemo(() => {
    const { items, subtotal, currency } = current.view
    const viewOf = (promise) => promise.then((view) => ({ view }))
    return {
      mode: customerId === null ? 'guest' : 'customer',
      status: current.status,
      error: current.error,
      items,
      subtotal,
      currency,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      quantityOf: (productId) => items.find((item) => item.productId === productId)?.quantity ?? 0,
      add: (productId, quantity = 1) => run((adapter) => viewOf(adapter.add(productId, quantity))),
      setQuantity: (productId, quantity) => run((adapter) => viewOf(adapter.setQuantity(productId, quantity))),
      remove: (productId) => run((adapter) => viewOf(adapter.remove(productId))),
      // Re-reads the cart, e.g. after checkout or when the server reports a changed cart
      refresh: () => run((adapter) => viewOf(adapter.load())),

      // Guest -> account merge: status 'none' | 'merged' | 'failed' (guest cart kept, retry offered)
      merge: current.merge,
      retryMerge: () => run((adapter) => mergeThenLoad(merger, adapter, customerId)),
      // Quantities the server reduced or products it could not add; reviewed before checkout
      adjustments: current.adjustments,
      needsReview: current.adjustments.length > 0,
      acknowledgeAdjustments: () => setState((s) => ({ ...s, adjustments: [] })),
    }
  }, [current, customerId, merger, run])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
