// Guest -> account merge tests. Run with: npm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { GUEST_CART_KEY, loadGuestCart, saveGuestCart } from './guestCartStorage.js'
import { PENDING_MERGE_KEY, createGuestMerge, describeAdjustment, loadPendingMerge } from './guestMerge.js'

function memoryStorage() {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  }
}

function keys() {
  let n = 0
  return () => `key-${++n}`
}

// A fake /cart/merge that records calls and adds guest lines to an account cart
function fakeServer(accountItems = []) {
  const calls = []
  let failuresLeft = 0
  return {
    calls,
    failNext(count = 1) {
      failuresLeft = count
    },
    async merge(requestKey, items) {
      calls.push({ requestKey, items })
      if (failuresLeft > 0) {
        failuresLeft -= 1
        throw Object.assign(new Error('offline'), { code: 'NETWORK_ERROR' })
      }
      const merged = new Map(accountItems.map((i) => [i.productId, i.quantity]))
      for (const { productId, quantity } of items) merged.set(productId, (merged.get(productId) ?? 0) + quantity)
      return { cart: { items: [...merged].map(([productId, quantity]) => ({ productId, quantity })) }, adjustments: [] }
    },
  }
}

describe('guest cart merge', () => {
  it('sends the guest cart once and uses the returned account cart, overlapping products included', async () => {
    const storage = memoryStorage()
    saveGuestCart([{ productId: 1, quantity: 2 }, { productId: 3, quantity: 1 }], storage)
    const server = fakeServer([{ productId: 1, quantity: 1 }])
    const merge = createGuestMerge({ storage, mergeRequest: server.merge, newRequestKey: keys() })

    const result = await merge.run(42)
    assert.equal(server.calls.length, 1)
    assert.deepEqual(result.cart.items, [{ productId: 1, quantity: 3 }, { productId: 3, quantity: 1 }])
    assert.deepEqual(loadGuestCart(storage), [])
    assert.equal(loadPendingMerge(storage), null)
  })

  it('keeps the guest cart after a failure and retries with the same key', async () => {
    const storage = memoryStorage()
    saveGuestCart([{ productId: 1, quantity: 2 }], storage)
    const server = fakeServer()
    server.failNext()
    const merge = createGuestMerge({ storage, mergeRequest: server.merge, newRequestKey: keys() })

    await assert.rejects(merge.run(42), { code: 'NETWORK_ERROR' })
    assert.deepEqual(loadGuestCart(storage), [{ productId: 1, quantity: 2 }])

    await merge.run(42)
    assert.deepEqual(server.calls.map((c) => c.requestKey), ['key-1', 'key-1'])
    assert.deepEqual(loadGuestCart(storage), [])
  })

  it('sends one request when the sign-in callback fires twice', async () => {
    const storage = memoryStorage()
    saveGuestCart([{ productId: 1, quantity: 1 }], storage)
    const server = fakeServer()
    const merge = createGuestMerge({ storage, mergeRequest: server.merge, newRequestKey: keys() })

    const [a, b] = await Promise.all([merge.run(42), merge.run(42)])
    assert.equal(server.calls.length, 1)
    assert.equal(a, b)
  })

  it('reuses the key after a page refresh during the merge', async () => {
    const storage = memoryStorage()
    saveGuestCart([{ productId: 1, quantity: 1 }], storage)
    const firstPage = createGuestMerge({
      storage,
      mergeRequest: () => new Promise(() => {}), // the page is closed before an answer arrives
      newRequestKey: () => 'before-refresh',
    })
    firstPage.run(42)

    const server = fakeServer()
    const afterRefresh = createGuestMerge({ storage, mergeRequest: server.merge, newRequestKey: () => 'new-key' })
    await afterRefresh.run(42)
    assert.equal(server.calls[0].requestKey, 'before-refresh')
  })

  it('uses a new key when the guest cart changed or another account signs in', async () => {
    const storage = memoryStorage()
    saveGuestCart([{ productId: 1, quantity: 1 }], storage)
    const server = fakeServer()
    server.failNext(2)
    const merge = createGuestMerge({ storage, mergeRequest: server.merge, newRequestKey: keys() })

    await assert.rejects(merge.run(42))
    saveGuestCart([{ productId: 1, quantity: 2 }], storage)
    await assert.rejects(merge.run(42))
    await merge.run(7)
    assert.deepEqual(server.calls.map((c) => c.requestKey), ['key-1', 'key-2', 'key-3'])
  })

  it('does nothing for an empty guest cart and drops a broken pending record', async () => {
    const storage = memoryStorage()
    storage.setItem(PENDING_MERGE_KEY, '{broken')
    const server = fakeServer()
    const merge = createGuestMerge({ storage, mergeRequest: server.merge })
    assert.deepEqual(await merge.run(42), { merged: false })
    assert.equal(server.calls.length, 0)
    assert.equal(storage.getItem(PENDING_MERGE_KEY), null)
    assert.equal(storage.getItem(GUEST_CART_KEY), null)
  })

  it('starts again with a new key when the server says the key was used for other items', async () => {
    const storage = memoryStorage()
    saveGuestCart([{ productId: 1, quantity: 2 }], storage)
    const calls = []
    const merge = createGuestMerge({
      storage,
      newRequestKey: keys(),
      mergeRequest: async (requestKey) => {
        calls.push(requestKey)
        if (calls.length === 1) throw Object.assign(new Error('reused'), { code: 'REQUEST_KEY_REUSED', status: 422 })
        return { cart: { items: [] }, adjustments: [] }
      },
    })
    assert.equal((await merge.run(42)).merged, true)
    assert.deepEqual(calls, ['key-1', 'key-2'])
    assert.equal(loadPendingMerge(storage), null)
    assert.deepEqual(loadGuestCart(storage), [])
  })

  it('describes merge adjustments', () => {
    assert.equal(
      describeAdjustment({ requested: 3, applied: 1, reason: 'INSUFFICIENT_STOCK' }),
      'Reduced from 3 to 1: only 1 in stock.',
    )
    assert.equal(describeAdjustment({ requested: 1, applied: 0, reason: 'OUT_OF_STOCK' }), 'Out of stock, so it was not added.')
    assert.equal(describeAdjustment({ requested: 1, applied: 0, reason: 'PRODUCT_UNAVAILABLE' }), 'No longer sold, so it was not added.')
  })
})
