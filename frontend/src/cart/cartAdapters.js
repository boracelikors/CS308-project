// The two cart back ends behind one interface: load, add, setQuantity, remove.
// Each method resolves with a cart view { items, subtotal, currency } (the GET /cart shape)
// or rejects with a CartActionError.
import { apiRequest } from '../api/request.js'
import {
  CartActionError,
  addLine,
  buildCartView,
  checkQuantity,
  quantityOf,
  removeLine,
  setLineQuantity,
} from './cartLogic.js'
import { browserStorage, loadGuestCart, saveGuestCart } from './guestCartStorage.js'

const fetchProducts = () => apiRequest('/products')

// Guest: lines live in localStorage; prices and stock come from a fresh GET /products.
export function createGuestCart({ storage = browserStorage(), loadProducts = fetchProducts } = {}) {
  let lines = loadGuestCart(storage)
  let productsById = null

  // Fetched once per adapter; a failed fetch is retried by the next call
  async function ensureProducts() {
    if (!productsById) {
      const products = await loadProducts()
      productsById = new Map(products.map((product) => [product.id, product]))
    }
    return productsById
  }

  function commit(nextLines) {
    lines = nextLines
    saveGuestCart(lines, storage)
    return buildCartView(lines, productsById)
  }

  return {
    async load() {
      await ensureProducts()
      return buildCartView(lines, productsById)
    },

    async add(productId, quantity = 1) {
      const product = (await ensureProducts()).get(productId)
      checkQuantity(quantity, product)
      // The total in the cart may not exceed stock either
      checkQuantity(quantityOf(lines, productId) + quantity, product)
      return commit(addLine(lines, productId, quantity))
    },

    async setQuantity(productId, quantity) {
      const products = await ensureProducts()
      if (quantityOf(lines, productId) === 0) {
        throw new CartActionError('CART_ITEM_NOT_FOUND', 'This product is not in your cart.')
      }
      checkQuantity(quantity, products.get(productId))
      return commit(setLineQuantity(lines, productId, quantity))
    },

    async remove(productId) {
      await ensureProducts()
      return commit(removeLine(lines, productId))
    },
  }
}

// Logged-in customer: the backend cart (SCRUM-28); the session cookie identifies the owner.
export function createServerCart({ request = apiRequest } = {}) {
  const cartOf = (promise) => promise.then((data) => data.cart)
  return {
    load: () => cartOf(request('/cart')),
    add: (productId, quantity = 1) =>
      cartOf(request('/cart/items', { method: 'POST', body: { productId, quantity } })),
    setQuantity: (productId, quantity) =>
      cartOf(request(`/cart/items/${productId}`, { method: 'PUT', body: { quantity } })),
    remove: (productId) => cartOf(request(`/cart/items/${productId}`, { method: 'DELETE' })),
  }
}
