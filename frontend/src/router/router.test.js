import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { matchRoute } from './router.js'

describe('matchRoute', () => {
  it('matches home route for root, empty path and index.html', () => {
    assert.deepEqual(matchRoute('/'), { name: 'home', params: {} })
    assert.deepEqual(matchRoute(''), { name: 'home', params: {} })
    assert.deepEqual(matchRoute('/index.html'), { name: 'home', params: {} })
  })

  it('matches valid product detail route and extracts positive integer id', () => {
    assert.deepEqual(matchRoute('/products/1'), { name: 'product-detail', params: { id: 1 } })
    assert.deepEqual(matchRoute('/products/14'), { name: 'product-detail', params: { id: 14 } })
    assert.deepEqual(matchRoute('/products/14/'), { name: 'product-detail', params: { id: 14 } })
  })

  it('rejects malformed or non-numeric product routes', () => {
    assert.deepEqual(matchRoute('/products/abc'), { name: 'not-found', params: {} })
    assert.deepEqual(matchRoute('/products/0'), { name: 'not-found', params: {} })
    assert.deepEqual(matchRoute('/products/-5'), { name: 'not-found', params: {} })
    assert.deepEqual(matchRoute('/products'), { name: 'not-found', params: {} })
  })

  it('matches cart route', () => {
    assert.deepEqual(matchRoute('/cart'), { name: 'cart', params: {} })
    assert.deepEqual(matchRoute('/cart/'), { name: 'cart', params: {} })
  })

  it('returns not-found for unknown routes', () => {
    assert.deepEqual(matchRoute('/unknown/page'), { name: 'not-found', params: {} })
  })
})
