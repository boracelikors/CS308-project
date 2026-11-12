import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CartContext } from './cartContext.js'
import { createGuestCart, createServerCart } from './cartAdapters.js'

const EMPTY_VIEW = { items: [], subtotal: '0.00', currency: null }
const LOADING = { status: 'loading', view: EMPTY_VIEW, error: null }

// Logged-in customers use their server cart; guests (and staff, who cannot buy) use the browser cart.
// The user ID is part of the key, so switching customers always starts a new, empty cart state.
function accountKeyFor(user) {
  return user?.role === 'customer' ? `customer:${user.id}` : 'guest'
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

// user: { id, role } from GET /auth/me, or null for a guest
export default function CartProvider({ user = null, children }) {
  const accountKey = accountKeyFor(user)
  const [state, setState] = useState({ accountKey, ...LOADING })
  const adapterRef = useRef(null)
  const queueRef = useRef(Promise.resolve())

  useEffect(() => {
    const adapter = accountKey === 'guest' ? createGuestCart() : createServerCart()
    adapterRef.current = adapter
    queueRef.current = Promise.resolve()

    adapter.load().then(
      (view) => {
        if (adapterRef.current === adapter) setState({ accountKey, status: 'ready', view, error: null })
      },
      (error) => {
        if (adapterRef.current === adapter) setState({ accountKey, ...LOADING, status: 'error', error: toCartError(error) })
      },
    )
    return () => {
      adapterRef.current = null
    }
  }, [accountKey])

  // Actions run one at a time, so a slow response cannot overwrite a newer one.
  // Results from a previous account's adapter are ignored.
  const run = useCallback((action) => {
    const adapter = adapterRef.current
    if (!adapter) {
      return Promise.resolve({ ok: false, code: 'CART_NOT_READY', message: 'The cart is still loading.' })
    }
    const result = queueRef.current.then(() => action(adapter)).then(
      (view) => {
        if (adapterRef.current === adapter) setState((s) => ({ ...s, status: 'ready', view, error: null }))
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
    return {
      mode: accountKey === 'guest' ? 'guest' : 'customer',
      status: current.status,
      error: current.error,
      items,
      subtotal,
      currency,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      quantityOf: (productId) => items.find((item) => item.productId === productId)?.quantity ?? 0,
      add: (productId, quantity = 1) => run((adapter) => adapter.add(productId, quantity)),
      setQuantity: (productId, quantity) => run((adapter) => adapter.setQuantity(productId, quantity)),
      remove: (productId) => run((adapter) => adapter.remove(productId)),
    }
  }, [accountKey, current, run])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
