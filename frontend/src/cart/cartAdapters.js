// The two cart back ends behind one interface: load, add, setQuantity, remove.
// Each method resolves with a cart view { items, subtotal, currency } (the GET /cart shape)
// or rejects with a CartActionError.
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

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:3001'

async function fetchProducts() {
  const response = await fetch(`${API_BASE_URL}/products`)
  if (!response.ok) throw new Error(`GET /products responded with ${response.status}`)
  return response.json()
}

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
export function createServerCart() {
  async function request(path, method = 'GET', body) {
    const response = await fetch(`${API_BASE_URL}/cart${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      const error = data?.error
      throw new CartActionError(
        error?.code ?? 'CART_REQUEST_FAILED',
        error?.message ?? 'The cart could not be updated.',
        error?.available === undefined ? {} : { available: error.available },
      )
    }
    return data.cart
  }

  return {
    load: () => request(''),
    add: (productId, quantity = 1) => request('/items', 'POST', { productId, quantity }),
    setQuantity: (productId, quantity) => request(`/items/${productId}`, 'PUT', { quantity }),
    remove: (productId) => request(`/items/${productId}`, 'DELETE'),
  }
}
