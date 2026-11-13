// The two cart back ends behind one interface: load, add, setQuantity, remove.
// Each method resolves with a cart view { items, subtotal, currency } (the GET /cart shape)
// or rejects with a CartActionError (guest rules) or an ApiError (server).
import { API_BASE_URL, apiRequest } from '../api/request.js'
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

// GET /products is paginated by the catalogue API (SCRUM-24): at most 50 per page, with the
// page count in the X-Total-Pages header. Without that header (Sprint 1 API) one call returns all.
export async function fetchProducts({ fetch: fetchImpl = fetch, maxPages = 20 } = {}) {
  const products = []
  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetchImpl(`${API_BASE_URL}/products?page=${page}&pageSize=50`)
    if (!response.ok) throw new Error(`GET /products responded with ${response.status}`)
    products.push(...(await response.json()))
    const totalPages = Number(response.headers.get('X-Total-Pages'))
    if (!Number.isInteger(totalPages) || page >= totalPages) break
  }
  return products
}

// Guest: lines live in localStorage; prices and stock come from a fresh GET /products.
export function createGuestCart({ storage = browserStorage(), loadProducts = () => fetchProducts() } = {}) {
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

    // POST /cart/merge (SCRUM-32, backend PR #25; see the README for the full rules)
    //   { requestKey, items: [{ productId, quantity }] }
    //   200 { cart, adjustments: [{ productId, name, requested, applied, reason }], replayed }
    //   The same key with the same items returns the first result; other items -> 422 REQUEST_KEY_REUSED.
    merge: (requestKey, items) => request('/cart/merge', { method: 'POST', body: { requestKey, items } }),
  }
}
