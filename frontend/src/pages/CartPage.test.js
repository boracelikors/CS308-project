import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canProceedToCheckout,
  describeProblem,
  formatCartTotal,
  getCheckoutDestination,
} from './cartPageLogic.js'

describe('Cart Page Scenarios (SCRUM-31)', () => {
  describe('Empty Cart State', () => {
    it('disables checkout and indicates that cart is empty', () => {
      const check = canProceedToCheckout([], 'ready')
      assert.equal(check.allowed, false)
      assert.equal(check.reason, 'Your cart is empty.')
    })
  })

  describe('Quantity Edit and Remove', () => {
    it('allows valid quantities within stock limits', () => {
      const normalItem = {
        productId: 14,
        name: 'Wireless Headphones',
        unitPrice: '17990.00',
        quantity: 2,
        lineTotal: '35980.00',
        stock: 20,
        problem: null,
      }
      const check = canProceedToCheckout([normalItem], 'ready')
      assert.equal(check.allowed, true)
    })

    it('rejects checkout when updating leaves the cart in an update/loading state', () => {
      const normalItem = { productId: 14, quantity: 2, problem: null }
      const check = canProceedToCheckout([normalItem], 'loading')
      assert.equal(check.allowed, false)
    })
  })

  describe('Rejected Update & Stock Constraints', () => {
    it('detects and flags out-of-stock lines with human-readable guidance', () => {
      const outOfStockLine = {
        productId: 7,
        name: 'Compact Soundbar',
        unitPrice: '24990.00',
        quantity: 1,
        lineTotal: '24990.00',
        stock: 0,
        problem: 'OUT_OF_STOCK',
      }

      const problemText = describeProblem(outOfStockLine.problem, outOfStockLine.stock)
      assert.match(problemText, /out of stock/i)

      const check = canProceedToCheckout([outOfStockLine], 'ready')
      assert.equal(check.allowed, false)
      assert.match(check.reason, /unavailable items/i)
    })

    it('flags insufficient stock lines and reports available limit', () => {
      const problemText = describeProblem('INSUFFICIENT_STOCK', 1)
      assert.equal(problemText, 'Only 1 left in stock. Please reduce the quantity.')
    })

    it('flags discontinued or unavailable products', () => {
      const problemText = describeProblem('UNAVAILABLE')
      assert.equal(problemText, 'This product is no longer available. Please remove it.')
    })
  })

  describe('Guest vs Customer Checkout Routing', () => {
    it('sends guest to login with safe encoded return path', () => {
      const guestDest = getCheckoutDestination('guest', '/cart')
      assert.equal(guestDest.isGuest, true)
      assert.equal(guestDest.url, '/login?returnTo=%2Fcart')
      assert.equal(guestDest.label, 'Sign in to Checkout')
    })

    it('sends logged-in customer directly to checkout page', () => {
      const customerDest = getCheckoutDestination('customer')
      assert.equal(customerDest.isGuest, false)
      assert.equal(customerDest.url, '/checkout')
      assert.equal(customerDest.label, 'Proceed to Checkout')
    })
  })

  describe('Fractional Total Formatting', () => {
    it('formats exact decimals for subtotal without floating-point inaccuracies', () => {
      assert.equal(formatCartTotal('18749.90', 'TRY'), '18.749,90 TRY')
      assert.equal(formatCartTotal('56249.70', 'TRY'), '56.249,70 TRY')
      assert.equal(formatCartTotal('149900.00', 'TRY'), '149.900 TRY')
    })
  })
})
