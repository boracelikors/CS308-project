import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CATEGORIES,
  DEFAULT_PAGE_SIZE,
  SORT_OPTIONS,
  buildCatalogQuery,
  filterAndSortProducts,
  parseCatalogParams,
  parsePaginationHeaders,
} from './catalogQuery.js'

describe('catalog constants', () => {
  it('defines 6 standard audio categories matching database seeds', () => {
    assert.equal(CATEGORIES.length, 6)
    assert.deepEqual(
      CATEGORIES.map((c) => c.name),
      ['Speakers', 'Soundbars', 'Subwoofers', 'Microphones', 'Headphones', 'DJ Controllers'],
    )
  })

  it('defines the 4 supported sort options', () => {
    assert.equal(SORT_OPTIONS.length, 4)
    assert.deepEqual(
      SORT_OPTIONS.map((o) => o.value),
      ['', 'price_asc', 'price_desc', 'popularity'],
    )
  })

  it('uses positive default page size', () => {
    assert.ok(DEFAULT_PAGE_SIZE > 0)
  })
})


// Realistic product fixtures matching backend seeds (including zero-stock, description-only, and fractional prices)
const SAMPLE_PRODUCTS = [
  {
    id: 1,
    name: 'Reference Bookshelf Monitors (Pair)',
    categoryId: 1,
    category: 'Speakers',
    price: '89900.00',
    currency: 'TRY',
    quantityInStock: 4,
    inStock: true,
    description: 'Hand-finished two-way bookshelf speakers with beryllium tweeters and a rigid aluminium cabinet.',
    unitsSold: 10,
  },
  {
    id: 2,
    name: 'Dolby Atmos 7.1.4 Soundbar',
    categoryId: 2,
    category: 'Soundbars',
    price: '64900.00',
    currency: 'TRY',
    quantityInStock: 6,
    inStock: true,
    description: 'Flagship soundbar with up-firing drivers and room calibration.',
    unitsSold: 25,
  },
  {
    id: 5,
    name: 'Planar Magnetic Open-Back Headphones',
    categoryId: 5,
    category: 'Headphones',
    price: '49900.00',
    currency: 'TRY',
    quantityInStock: 10,
    inStock: true,
    description: 'Audiophile open-back headphones with planar magnetic drivers.',
    unitsSold: 15,
  },
  {
    id: 7,
    name: 'Compact Atmos 3.1.2 Soundbar',
    categoryId: 2,
    category: 'Soundbars',
    price: '24990.00',
    currency: 'TRY',
    quantityInStock: 0,
    inStock: false,
    description: 'Space-saving soundbar with a dedicated centre channel.',
    unitsSold: 5,
  },
  {
    id: 9,
    name: 'Closed-Back Studio Reference Headphones',
    categoryId: 5,
    category: 'Headphones',
    price: '24990.00',
    currency: 'TRY',
    quantityInStock: 12,
    inStock: true,
    description: 'Isolating closed-back headphones with a flat response for tracking and mixing.',
    unitsSold: 30,
  },
  {
    id: 10,
    name: '10-Inch Ported Subwoofer',
    categoryId: 3,
    category: 'Subwoofers',
    price: '18749.90',
    currency: 'TRY',
    quantityInStock: 7,
    inStock: true,
    description: 'Front-ported subwoofer with a 400W amplifier.',
    unitsSold: 8,
  },
  {
    id: 14,
    name: 'Wireless Hi-Res Noise-Cancelling Headphones',
    categoryId: 5,
    category: 'Headphones',
    price: '17990.00',
    currency: 'TRY',
    quantityInStock: 20,
    inStock: true,
    description: 'Over-ear wireless headphones with adaptive noise cancelling.',
    unitsSold: 50,
  },
]

describe('parseCatalogParams', () => {
  it('parses empty or missing search string into default values', () => {
    assert.deepEqual(parseCatalogParams(''), { search: '', categoryId: '', sort: '', page: 1 })
    assert.deepEqual(parseCatalogParams('?'), { search: '', categoryId: '', sort: '', page: 1 })
  })

  it('parses valid search, category, sort, and page parameters', () => {
    const query = '?search=headphones&categoryId=5&sort=price_asc&page=3'
    assert.deepEqual(parseCatalogParams(query), {
      search: 'headphones',
      categoryId: '5',
      sort: 'price_asc',
      page: 3,
    })
  })

  it('ignores invalid parameters or sorts and trims search text', () => {
    const query = '?search=%20subwoofer%20&categoryId=abc&sort=invalid_sort&page=-5&extra=ignored'
    assert.deepEqual(parseCatalogParams(query), {
      search: 'subwoofer',
      categoryId: '',
      sort: '',
      page: 1,
    })
  })

  it('caps search query length at 100 characters', () => {
    const longSearch = 'a'.repeat(120)
    const result = parseCatalogParams(`?search=${longSearch}`)
    assert.equal(result.search.length, 100)
  })
})

describe('buildCatalogQuery', () => {
  it('builds clean browser URL query and backend API query', () => {
    const { urlQuery, apiQuery } = buildCatalogQuery({
      search: 'headphones',
      categoryId: '5',
      sort: 'price_asc',
      page: 2,
      pageSize: 12,
    })
    assert.equal(urlQuery, '?search=headphones&categoryId=5&sort=price_asc&page=2')
    assert.equal(apiQuery, '?search=headphones&categoryId=5&sort=price_asc&page=2&pageSize=12')
  })

  it('omits defaults from browser URL query (empty search/category/sort, page 1)', () => {
    const { urlQuery, apiQuery } = buildCatalogQuery({
      search: '',
      categoryId: '',
      sort: '',
      page: 1,
      pageSize: 20,
    })
    assert.equal(urlQuery, '')
    assert.equal(apiQuery, '?page=1&pageSize=20')
  })
})

describe('parsePaginationHeaders', () => {
  it('reads pagination headers safely from Map or object', () => {
    const headers = new Map([
      ['X-Total-Count', '14'],
      ['X-Page', '2'],
      ['X-Page-Size', '6'],
      ['X-Total-Pages', '3'],
    ])
    const meta = parsePaginationHeaders(headers)
    assert.deepEqual(meta, {
      total: 14,
      page: 2,
      pageSize: 6,
      totalPages: 3,
    })
  })

  it('computes totalPages if missing in headers and falls back to defaults', () => {
    const headers = { 'x-total-count': '25' }
    const meta = parsePaginationHeaders(headers, 10)
    assert.equal(meta.total, 25)
    assert.equal(meta.page, 1)
    assert.equal(meta.pageSize, 10)
    assert.equal(meta.totalPages, 3)
  })

  it('returns 0 totalPages when total is 0', () => {
    const meta = parsePaginationHeaders({ 'x-total-count': '0' }, 12)
    assert.equal(meta.total, 0)
    assert.equal(meta.totalPages, 0)
  })
})

describe('filterAndSortProducts', () => {
  it('finds description-only matches (e.g. "beryllium" appears ONLY in product 1 description)', () => {
    const results = filterAndSortProducts(SAMPLE_PRODUCTS, { search: 'beryllium' })
    assert.equal(results.length, 1)
    assert.equal(results[0].id, 1)
    assert.match(results[0].description, /beryllium/)
  })

  it('retains zero-stock products in visible results (product 7 has stock 0)', () => {
    const soundbars = filterAndSortProducts(SAMPLE_PRODUCTS, { categoryId: '2' })
    assert.equal(soundbars.length, 2)
    const zeroStock = soundbars.find((p) => p.id === 7)
    assert.ok(zeroStock, 'Zero stock product 7 must remain visible in the catalogue')
    assert.equal(zeroStock.quantityInStock, 0)
    assert.equal(zeroStock.inStock, false)
  })

  it('supports combined filters: category + search + sort', () => {
    const results = filterAndSortProducts(SAMPLE_PRODUCTS, {
      categoryId: '5',
      search: 'headphones',
      sort: 'price_asc',
    })
    assert.equal(results.length, 3)
    assert.deepEqual(
      results.map((p) => p.id),
      [14, 9, 5],
    )
    assert.equal(results[0].price, '17990.00')
    assert.equal(results[1].price, '24990.00')
    assert.equal(results[2].price, '49900.00')
  })

  it('sorts by every supported direction: price_asc, price_desc, popularity, and default', () => {
    // 1. price_asc
    const asc = filterAndSortProducts(SAMPLE_PRODUCTS, { sort: 'price_asc' })
    assert.equal(asc[0].id, 14) // 17990.00
    // Tied price (7 and 9 both 24990.00) sorted by id ascending (7 then 9)
    const tied7 = asc.findIndex((p) => p.id === 7)
    const tied9 = asc.findIndex((p) => p.id === 9)
    assert.ok(tied7 < tied9, 'Tied prices must be ordered by product ID ascending')

    // 2. price_desc
    const desc = filterAndSortProducts(SAMPLE_PRODUCTS, { sort: 'price_desc' })
    assert.equal(desc[0].id, 1) // 89900.00
    assert.equal(desc[desc.length - 1].id, 14) // 17990.00

    // 3. popularity (unitsSold DESC)
    const pop = filterAndSortProducts(SAMPLE_PRODUCTS, { sort: 'popularity' })
    assert.equal(pop[0].id, 14) // 50 units sold
    assert.equal(pop[1].id, 9) // 30 units sold
    assert.equal(pop[2].id, 2) // 25 units sold

    // 4. default (id ASC)
    const def = filterAndSortProducts(SAMPLE_PRODUCTS)
    assert.deepEqual(
      def.map((p) => p.id),
      [1, 2, 5, 7, 9, 10, 14],
    )
  })

  it('returns empty array when search matches nothing', () => {
    const results = filterAndSortProducts(SAMPLE_PRODUCTS, { search: 'nonexistent keyword xyz' })
    assert.equal(results.length, 0)
  })
})

describe('stale response handling', () => {
  it('ignores older out-of-order responses using request counter', async () => {
    let latestApplied = null
    let latestId = 0

    function makeRequest(id, delayMs, value) {
      latestId = id
      return new Promise((resolve) => {
        setTimeout(() => {
          if (id === latestId) {
            latestApplied = value
          }
          resolve(latestApplied)
        }, delayMs)
      })
    }

    // Request 1 starts with longer delay (slow network)
    const req1 = makeRequest(1, 50, 'result-1')
    // Request 2 starts right after with shorter delay (fast network)
    const req2 = makeRequest(2, 10, 'result-2')

    await Promise.all([req1, req2])
    // The fast req2 completed, then slow req1 completed later.
    // latestApplied MUST still be 'result-2' (the newer request), NOT overwritten by req1!
    assert.equal(latestApplied, 'result-2')
  })
})
