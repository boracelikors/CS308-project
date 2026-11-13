import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canProceedToCheckout,
  describeProblem,
  formatCartTotal,
  getCheckoutDestination,
} from './cartPageLogic.js'

describe('canProceedToCheckout', () => {
  it('blocks checkout when cart is empty', () => {
    assert.deepEqual(canProceedToCheckout([], 'ready'), {
      allowed: false,
      reason: 'Your cart is empty.',
    })
  })

  it('blocks checkout when cart status is loading or error', () => {
    const items = [{ productId: 1, quantity: 1, problem: null }]
    assert.equal(canProceedToCheckout(items, 'loading').allowed, false)
  })

  it('blocks checkout when any item has a problem (out of stock, insufficient stock, unavailable)', () => {
    const itemsWithProblem = [
      { productId: 1, quantity: 1, problem: null },
      { productId: 7, quantity: 1, problem: 'OUT_OF_STOCK' },
    ]
    const result = canProceedToCheckout(itemsWithProblem, 'ready')
    assert.equal(result.allowed, false)
    assert.match(result.reason, /unavailable items/)
  })

  it('allows checkout with a valid nonempty cart and no problem lines', () => {
    const validItems = [
      { productId: 14, quantity: 2, problem: null },
      { productId: 10, quantity: 1, problem: null },
    ]
    assert.deepEqual(canProceedToCheckout(validItems, 'ready'), { allowed: true })
  })
})

describe('describeProblem', () => {
  it('returns human-readable text for each problem type', () => {
    assert.match(describeProblem('OUT_OF_STOCK'), /out of stock/i)
    assert.match(describeProblem('INSUFFICIENT_STOCK', 3), /Only 3 left in stock/i)
    assert.match(describeProblem('UNAVAILABLE'), /no longer available/i)
    assert.equal(describeProblem(null), null)
  })
})

describe('getCheckoutDestination', () => {
  it('sends guest to login with safe returnTo', () => {
    const destination = getCheckoutDestination('guest', '/cart')
    assert.equal(destination.isGuest, true)
    assert.equal(destination.url, '/login?returnTo=%2Fcart')
    assert.equal(destination.label, 'Sign in to Checkout')
  })

  it('sends logged-in customer directly to checkout', () => {
    const destination = getCheckoutDestination('customer')
    assert.equal(destination.isGuest, false)
    assert.equal(destination.url, '/checkout')
    assert.equal(destination.label, 'Proceed to Checkout')
  })
})

describe('formatCartTotal', () => {
  it('formats subtotal exact decimals with currency', () => {
    assert.equal(formatCartTotal('18749.90', 'TRY'), '18.749,90 TRY')
    assert.equal(formatCartTotal('89900.00', 'TRY'), '89.900 TRY')
    assert.equal(formatCartTotal(null, 'TRY'), '0 TRY')
  })
})
