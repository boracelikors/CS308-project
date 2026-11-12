// API request helper tests. Run with: npm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError, apiRequest } from './request.js'

function respond(status, body) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('no body')
      return body
    },
  })
}

describe('apiRequest', () => {
  it('sends the login cookie and a JSON body', async () => {
    let seen
    const data = await apiRequest('/cart/items', {
      method: 'POST',
      body: { productId: 1 },
      fetch: async (url, options) => {
        seen = { url, ...options }
        return respond(200, { cart: {} })()
      },
    })
    assert.deepEqual(data, { cart: {} })
    assert.equal(seen.url, 'http://localhost:3001/cart/items')
    assert.equal(seen.credentials, 'include')
    assert.equal(seen.body, '{"productId":1}')
  })

  it('turns the backend error shape into an ApiError', async () => {
    const error = await apiRequest('/cart/items', {
      fetch: respond(409, { error: { code: 'INSUFFICIENT_STOCK', message: 'Only 1 left in stock.', available: 1 } }),
    }).catch((e) => e)
    assert.ok(error instanceof ApiError)
    assert.equal(error.code, 'INSUFFICIENT_STOCK')
    assert.equal(error.available, 1)
    assert.equal(error.status, 409)
    assert.equal(error.uncertain, false)
  })

  it('marks network failures and server errors as uncertain', async () => {
    const offline = await apiRequest('/checkout', {
      fetch: async () => {
        throw new TypeError('Failed to fetch')
      },
    }).catch((e) => e)
    assert.equal(offline.code, 'NETWORK_ERROR')
    assert.equal(offline.uncertain, true)

    const crashed = await apiRequest('/checkout', { fetch: respond(502) }).catch((e) => e)
    assert.equal(crashed.code, 'REQUEST_FAILED')
    assert.equal(crashed.uncertain, true)

    const unreadable = await apiRequest('/checkout', { fetch: respond(200) }).catch((e) => e)
    assert.equal(unreadable.code, 'BAD_RESPONSE')
    assert.equal(unreadable.uncertain, true)
  })

  it('returns null for 204 and lets aborts through', async () => {
    assert.equal(await apiRequest('/auth/logout', { fetch: respond(204) }), null)
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    await assert.rejects(
      apiRequest('/orders', {
        fetch: async () => {
          throw abort
        },
      }),
      abort,
    )
  })
})
