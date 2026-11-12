import { createContext, useContext } from 'react'

export const CartContext = createContext(null)

// The shared cart interface for cards, product details, the cart page and the header:
// {
//   mode: 'guest' | 'customer', status: 'loading' | 'ready' | 'error',
//   error: { code, message, available? } | null,   // last failed load or action
//   items, subtotal, currency,                     // same shape as GET /cart; subtotal is display-only
//   itemCount, quantityOf(productId),
//   add(productId, quantity = 1), setQuantity(productId, quantity), remove(productId)
// }
// The three actions resolve with { ok: true } or { ok: false, code, message[, available] }.
export function useCart() {
  const cart = useContext(CartContext)
  if (!cart) throw new Error('useCart must be used inside <CartProvider>.')
  return cart
}
