import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  checkMandatoryFields,
  computeRemainingAllowed,
  getProductStock,
  validateQuantity,
} from './productDetailLogic.js'

describe('validateQuantity', () => {
  it('accepts positive whole numbers within stock limits', () => {
    assert.deepEqual(validateQuantity(1, 5), { ok: true, value: 1 })
    assert.deepEqual(validateQuantity('3', 5), { ok: true, value: 3 })
    assert.deepEqual(validateQuantity(5, 5), { ok: true, value: 5 })
  })

  it('rejects zero, negative numbers, floats, and non-numeric inputs', () => {
    assert.equal(validateQuantity(0, 5).ok, false)
    assert.equal(validateQuantity(-1, 5).ok, false)
    assert.equal(validateQuantity(1.5, 5).ok, false)
    assert.equal(validateQuantity('abc', 5).ok, false)
    assert.equal(validateQuantity('', 5).ok, false)
  })

  it('rejects quantities exceeding available stock', () => {
    const result = validateQuantity(10, 5)
    assert.equal(result.ok, false)
    assert.match(result.error, /Only 5 items left/)
  })

  it('reports out of stock for zero stock limit', () => {
    const result = validateQuantity(1, 0)
    assert.equal(result.ok, false)
    assert.match(result.error, /out of stock/)
  })
})

describe('getProductStock', () => {
  it('correctly identifies in stock and low stock', () => {
    const normal = getProductStock({ quantityInStock: 10, inStock: true })
    assert.equal(normal.stock, 10)
    assert.equal(normal.isOutOfStock, false)
    assert.equal(normal.isLowStock, false)

    const low = getProductStock({ quantityInStock: 2, inStock: true })
    assert.equal(low.isLowStock, true)
    assert.equal(low.isOutOfStock, false)
  })

  it('correctly identifies zero stock', () => {
    const out = getProductStock({ quantityInStock: 0, inStock: false })
    assert.equal(out.isOutOfStock, true)
    assert.equal(out.stock, 0)
  })
})

describe('computeRemainingAllowed', () => {
  it('calculates remaining quantity factoring in items already in cart', () => {
    const product = { quantityInStock: 5, inStock: true }
    assert.equal(computeRemainingAllowed(product, 2), 3)
    assert.equal(computeRemainingAllowed(product, 5), 0)
    assert.equal(computeRemainingAllowed(product, 6), 0)
  })

  it('returns 0 for out of stock products', () => {
    const product = { quantityInStock: 0, inStock: false }
    assert.equal(computeRemainingAllowed(product, 0), 0)
  })
})

describe('checkMandatoryFields', () => {
  it('validates that all mandatory R9 fields are present and non-empty', () => {
    const completeProduct = {
      id: 14,
      name: 'Wireless Hi-Res Headphones',
      model: 'DB-HP-W2',
      serialNumber: 'DEMO-HPH-0014',
      description: 'Over-ear wireless headphones with ANC.',
      category: 'Headphones',
      price: '17990.00',
      currency: 'TRY',
      quantityInStock: 20,
      inStock: true,
      warrantyStatus: '2 years',
      distributor: 'Bosphorus Pro Sound Supply',
    }
    assert.equal(checkMandatoryFields(completeProduct), true)
  })

  it('returns false if any R9 field is missing or empty', () => {
    const incomplete = {
      name: 'Headphones',
      price: '100.00',
      // missing model, serialNumber, warrantyStatus, distributor, etc.
    }
    assert.equal(checkMandatoryFields(incomplete), false)
  })
})
