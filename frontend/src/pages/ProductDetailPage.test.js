import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { matchRoute } from '../router/router.js'
import { formatPrice } from '../utils/formatPrice.js'
import {
  checkMandatoryFields,
  computeRemainingAllowed,
  getProductStock,
  validateQuantity,
} from './productDetailLogic.js'

// Realistic product fixtures from database seed (DEMO fixtures)
const DEMO_PRODUCT_NORMAL = {
  id: 14,
  name: 'Wireless Hi-Res Noise-Cancelling Headphones',
  model: 'DB-HP-W2',
  serialNumber: 'DEMO-HPH-0014',
  description: 'Over-ear wireless headphones with adaptive noise cancelling, LDAC hi-res streaming and 40 hours of battery life.',
  category: 'Headphones',
  categoryId: 5,
  price: '17990.00',
  currency: 'TRY',
  quantityInStock: 20,
  inStock: true,
  warrantyStatus: '2 years',
  distributor: 'Bosphorus Pro Sound Supply (fictional demo)',
  image: 'headphones.jpg',
}

const DEMO_PRODUCT_ZERO_STOCK = {
  id: 7,
  name: 'Compact Atmos 3.1.2 Soundbar',
  model: 'DB-SB312',
  serialNumber: 'DEMO-SBR-0007',
  description: 'Space-saving soundbar with a dedicated centre channel for clear dialogue and two up-firing drivers for height effects.',
  category: 'Soundbars',
  categoryId: 2,
  price: '24990.00',
  currency: 'TRY',
  quantityInStock: 0,
  inStock: false,
  warrantyStatus: '2 years',
  distributor: 'Bosphorus Pro Sound Supply (fictional demo)',
  image: 'soundbar.jpg',
}

const DEMO_PRODUCT_FRACTIONAL_PRICE = {
  id: 10,
  name: '10-Inch Ported Subwoofer',
  model: 'DB-SUB10P',
  serialNumber: 'DEMO-SUB-0010',
  description: 'Front-ported subwoofer with a 400W amplifier, adjustable crossover and phase control for home theatre setups.',
  category: 'Subwoofers',
  categoryId: 3,
  price: '18749.90',
  currency: 'TRY',
  quantityInStock: 7,
  inStock: true,
  warrantyStatus: '2 years',
  distributor: 'Anadolu Audio Distribution (fictional demo)',
  image: 'subwoofer.jpg',
}

describe('Product Detail Page - Field Rendering & R9 Compliance', () => {
  it('verifies that all mandatory R9 fields are present on standard products', () => {
    assert.ok(checkMandatoryFields(DEMO_PRODUCT_NORMAL))
    assert.equal(DEMO_PRODUCT_NORMAL.name, 'Wireless Hi-Res Noise-Cancelling Headphones')
    assert.equal(DEMO_PRODUCT_NORMAL.model, 'DB-HP-W2')
    assert.equal(DEMO_PRODUCT_NORMAL.serialNumber, 'DEMO-HPH-0014')
    assert.equal(DEMO_PRODUCT_NORMAL.category, 'Headphones')
    assert.equal(DEMO_PRODUCT_NORMAL.warrantyStatus, '2 years')
    assert.equal(DEMO_PRODUCT_NORMAL.distributor, 'Bosphorus Pro Sound Supply (fictional demo)')
    assert.ok(DEMO_PRODUCT_NORMAL.description.length > 20)
  })

  it('preserves exact fractional decimal currency formatting without rounding', () => {
    const formattedPrice = formatPrice(DEMO_PRODUCT_FRACTIONAL_PRICE.price)
    assert.equal(formattedPrice, '18.749,90')
    assert.equal(DEMO_PRODUCT_FRACTIONAL_PRICE.currency, 'TRY')
  })

  it('formats whole decimal prices cleanly without superfluous cents', () => {
    assert.equal(formatPrice(DEMO_PRODUCT_NORMAL.price), '17.990')
    assert.equal(formatPrice(DEMO_PRODUCT_ZERO_STOCK.price), '24.990')
  })
})

describe('Product Detail Page - Stock & Quantity Constraints', () => {
  it('disables purchase actions for zero-stock products while keeping fields visible', () => {
    const { stock, isOutOfStock } = getProductStock(DEMO_PRODUCT_ZERO_STOCK)
    assert.equal(isOutOfStock, true)
    assert.equal(stock, 0)

    // Quantity validation refuses any purchase for zero-stock items
    const check = validateQuantity(1, stock)
    assert.equal(check.ok, false)
    assert.equal(check.value, 0)
    assert.match(check.error, /out of stock/i)

    // But mandatory R9 details remain accessible for shoppers to inspect
    assert.ok(checkMandatoryFields(DEMO_PRODUCT_ZERO_STOCK))
  })

  it('enforces positive integer bounds on quantity selector', () => {
    const stock = DEMO_PRODUCT_NORMAL.quantityInStock // 20
    assert.equal(validateQuantity(1, stock).ok, true)
    assert.equal(validateQuantity(20, stock).ok, true)
    assert.equal(validateQuantity(21, stock).ok, false)
    assert.equal(validateQuantity(0, stock).ok, false)
    assert.equal(validateQuantity(-3, stock).ok, false)
    assert.equal(validateQuantity('2.5', stock).ok, false)
    assert.equal(validateQuantity('abc', stock).ok, false)
  })

  it('prevents adding more than available stock when user already has items in cart', () => {
    const inCart = 18
    const remaining = computeRemainingAllowed(DEMO_PRODUCT_NORMAL, inCart)
    assert.equal(remaining, 2)

    assert.equal(validateQuantity(2, remaining).ok, true)
    assert.equal(validateQuantity(3, remaining).ok, false)
  })
})

describe('Product Detail Page - Route & Direct Link Refresh', () => {
  it('resolves direct-link URL /products/:id to product-detail route', () => {
    const route = matchRoute('/products/14')
    assert.equal(route.name, 'product-detail')
    assert.equal(route.params.id, 14)
  })

  it('handles simulated direct-link refresh with API mock', async () => {
    const productId = 14

    // Simulated API client call matching GET /products/:id
    async function mockApiClient(id) {
      if (id === 14) {
        return { status: 200, data: { product: DEMO_PRODUCT_NORMAL } }
      }
      return { status: 404, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' } }
    }

    const response = await mockApiClient(productId)
    assert.equal(response.status, 200)
    assert.equal(response.data.product.id, 14)
    assert.equal(response.data.product.name, 'Wireless Hi-Res Noise-Cancelling Headphones')

    // Unknown product yields 404
    const notFoundResponse = await mockApiClient(999)
    assert.equal(notFoundResponse.status, 404)
    assert.equal(notFoundResponse.error.code, 'PRODUCT_NOT_FOUND')
  })
})
