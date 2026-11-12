// Guest cart unit tests. Run with: npm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createGuestCart } from './cartAdapters.js'
import {
  CartActionError,
  addLine,
  buildCartView,
  countItems,
  normalizeLines,
  removeLine,
  setLineQuantity,
  toMinorUnits,
} from './cartLogic.js'
import { GUEST_CART_KEY, loadGuestCart, saveGuestCart } from './guestCartStorage.js'

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    raw: (key) => data.get(key),
  }
}

// Same edge cases as the seed fixtures: no stock, one left, fractional price
const PRODUCTS = [
  { id: 1, name: 'Monitors', price: 89900, currency: 'TRY', image: 'speaker.jpg', stock: 4 },
  { id: 7, name: 'Soundbar', price: '24990.00', currency: 'TRY', image: 'soundbar.jpg', stock: 0 },
  { id: 8, name: 'Towers', price: '149900.00', currency: 'TRY', image: 'speaker.jpg', stock: 1 },
  { id: 10, name: 'Subwoofer', price: '18749.90', currency: 'TRY', image: 'subwoofer.jpg', stock: 5 },
  { id: 2, name: 'No stock field (Sprint 1 /products)', price: 64900, currency: 'TRY', image: 'soundbar.jpg' },
]
const byId = new Map(PRODUCTS.map((p) => [p.id, p]))

function guestCart(storage = memoryStorage(), products = PRODUCTS) {
  return createGuestCart({ storage, loadProducts: async () => products })
}

describe('cart lines', () => {
  it('adds the same product repeatedly as one line', () => {
    let lines = addLine([], 1, 1)
    lines = addLine(lines, 1, 2)
    lines = addLine(lines, 10, 1)
    assert.deepEqual(lines, [{ productId: 1, quantity: 3 }, { productId: 10, quantity: 1 }])
    assert.equal(countItems(lines), 4)
  })

  it('sets and removes quantities', () => {
    const lines = [{ productId: 1, quantity: 3 }, { productId: 10, quantity: 1 }]
    assert.deepEqual(setLineQuantity(lines, 1, 2), [{ productId: 1, quantity: 2 }, { productId: 10, quantity: 1 }])
    assert.deepEqual(removeLine(lines, 1), [{ productId: 10, quantity: 1 }])
    assert.deepEqual(removeLine(lines, 99), lines)
  })

  it('merges duplicate lines in memory and drops invalid ones', () => {
    const merged = normalizeLines([
      { productId: 1, quantity: 2 },
      { productId: 1, quantity: 3 },
      { productId: '2', quantity: 1 },
      { productId: 3, quantity: 0 },
      { productId: 4, quantity: 1.5 },
      { productId: 5, quantity: -1 },
      null,
      { productId: 6, quantity: 1, price: 1 },
    ])
    assert.deepEqual(merged, [{ productId: 1, quantity: 5 }, { productId: 6, quantity: 1 }])
  })
})

describe('cart view', () => {
  it('derives exact totals in kuruş from current product data', () => {
    const view = buildCartView([{ productId: 10, quantity: 3 }, { productId: 1, quantity: 1 }], byId)
    assert.equal(view.items[0].lineTotal, '56249.70')
    assert.equal(view.subtotal, '146149.70')
    assert.equal(view.currency, 'TRY')
    assert.equal(toMinorUnits(0.1 + 0.2), null) // never accepts float noise as money
  })

  it('shows problem lines but leaves them out of the subtotal', () => {
    const view = buildCartView(
      [{ productId: 7, quantity: 1 }, { productId: 8, quantity: 2 }, { productId: 99, quantity: 1 }, { productId: 1, quantity: 1 }],
      byId,
    )
    assert.deepEqual(view.items.map((item) => item.problem), ['OUT_OF_STOCK', 'INSUFFICIENT_STOCK', 'UNAVAILABLE', null])
    assert.equal(view.items[2].name, null)
    assert.equal(view.subtotal, '89900.00')
  })
})

describe('guest storage', () => {
  it('restores the cart after a refresh', () => {
    const storage = memoryStorage()
    saveGuestCart([{ productId: 1, quantity: 2 }], storage)
    assert.deepEqual(loadGuestCart(storage), [{ productId: 1, quantity: 2 }])
  })

  it('stores only product IDs and quantities', () => {
    const storage = memoryStorage()
    saveGuestCart([{ productId: 1, quantity: 2, unitPrice: '1.00', name: 'x' }], storage)
    assert.deepEqual(JSON.parse(storage.raw(GUEST_CART_KEY)), { version: 1, items: [{ productId: 1, quantity: 2 }] })
  })

  it('recovers from malformed or old data without throwing', () => {
    for (const raw of ['{not json', '"text"', 'null', '[]', '{"version":0,"items":[]}', '{"version":1,"items":{}}']) {
      const storage = memoryStorage({ [GUEST_CART_KEY]: raw })
      assert.deepEqual(loadGuestCart(storage), [], raw)
      assert.equal(storage.raw(GUEST_CART_KEY), undefined, `discards ${raw}`)
    }
  })

  it('works when storage is unavailable or throws', () => {
    const broken = {
      getItem() { throw new Error('blocked') },
      setItem() { throw new Error('blocked') },
      removeItem() { throw new Error('blocked') },
    }
    assert.deepEqual(loadGuestCart(broken), [])
    assert.doesNotThrow(() => saveGuestCart([{ productId: 1, quantity: 1 }], broken))
    assert.deepEqual(loadGuestCart(null), [])
  })
})

describe('guest cart adapter', () => {
  it('adds, sets and removes, persisting every change', async () => {
    const storage = memoryStorage()
    const cart = guestCart(storage)
    await cart.load()
    await cart.add(1)
    await cart.add(1, 2)
    let view = await cart.setQuantity(1, 2)
    assert.deepEqual(view.items.map((i) => [i.productId, i.quantity]), [[1, 2]])
    view = await cart.remove(1)
    assert.deepEqual(view.items, [])
    assert.deepEqual(loadGuestCart(storage), [])
  })

  it('restores quantities with fresh prices after a refresh', async () => {
    const storage = memoryStorage()
    const before = guestCart(storage)
    await before.add(10, 2)

    const repriced = PRODUCTS.map((p) => (p.id === 10 ? { ...p, price: '20000.00' } : p))
    const view = await guestCart(storage, repriced).load()
    assert.equal(view.items[0].quantity, 2)
    assert.equal(view.items[0].unitPrice, '20000.00')
    assert.equal(view.subtotal, '40000.00')
  })

  it('enforces stock limits and keeps zero-stock products out', async () => {
    const cart = guestCart()
    await assert.rejects(cart.add(7), { code: 'OUT_OF_STOCK' })
    await cart.add(8)
    await assert.rejects(cart.add(8), { code: 'INSUFFICIENT_STOCK', available: 1 })
    await assert.rejects(cart.setQuantity(8, 2), { code: 'INSUFFICIENT_STOCK' })
    await assert.rejects(cart.add(99), { code: 'PRODUCT_NOT_FOUND' })
    await assert.rejects(cart.add(1, 0), { code: 'INVALID_QUANTITY' })
    await assert.rejects(cart.add(1, -1), CartActionError)
    await assert.rejects(cart.setQuantity(10, 1), { code: 'CART_ITEM_NOT_FOUND' })
  })

  it('leaves the stock check to the server when product data has no stock', async () => {
    const view = await guestCart().add(2, 5)
    assert.equal(view.items[0].stock, null)
    assert.equal(view.items[0].problem, null)
  })

  it('retries loading products after a failed request', async () => {
    let calls = 0
    const cart = createGuestCart({
      storage: memoryStorage(),
      loadProducts: async () => {
        calls += 1
        if (calls === 1) throw new Error('offline')
        return PRODUCTS
      },
    })
    await assert.rejects(cart.load(), /offline/)
    assert.equal((await cart.add(1)).items.length, 1)
  })
})
