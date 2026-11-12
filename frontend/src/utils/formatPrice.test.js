import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatPrice } from './formatPrice.js'

describe('formatPrice', () => {
  it('formats integer numbers and integer strings with thousands separators', () => {
    assert.equal(formatPrice(89900), '89.900')
    assert.equal(formatPrice('89900'), '89.900')
    assert.equal(formatPrice(64900), '64.900')
  })

  it('formats whole decimal strings ending in .00 without trailing cents', () => {
    assert.equal(formatPrice('89900.00'), '89.900')
    assert.equal(formatPrice('24990.00'), '24.990')
    assert.equal(formatPrice('9990.00'), '9.990')
  })

  it('preserves fractional decimal cents without rounding', () => {
    assert.equal(formatPrice('18749.90'), '18.749,90')
    assert.equal(formatPrice('1999.99'), '1.999,99')
    assert.equal(formatPrice(18749.9), '18.749,9')
  })

  it('handles null, undefined, empty string safely', () => {
    assert.equal(formatPrice(null), '')
    assert.equal(formatPrice(undefined), '')
    assert.equal(formatPrice(''), '')
    assert.equal(formatPrice('   '), '')
  })

  it('returns invalid non-numeric strings unchanged', () => {
    assert.equal(formatPrice('free'), 'free')
  })
})
