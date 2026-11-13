// Pure catalog query and filter logic matching backend Sprint 2 contract (SCRUM-24 & SCRUM-25).
// No React or DOM dependencies so it can be 100% unit tested.

export const CATEGORIES = [
  { id: 1, name: 'Speakers' },
  { id: 2, name: 'Soundbars' },
  { id: 3, name: 'Subwoofers' },
  { id: 4, name: 'Microphones' },
  { id: 5, name: 'Headphones' },
  { id: 6, name: 'DJ Controllers' },
]

export const SORT_OPTIONS = [
  { value: '', label: 'Featured' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'popularity', label: 'Popularity' },
]

export const DEFAULT_PAGE_SIZE = 12
export const MAX_SEARCH_LENGTH = 100

const ALLOWED_SORTS = new Set(['price_asc', 'price_desc', 'popularity'])

/**
 * Extracts and sanitizes catalog query parameters from a URL search string.
 * e.g. "?search=headphones&categoryId=5&sort=price_asc&page=2"
 */
export function parseCatalogParams(searchString = '') {
  const query = searchString.startsWith('?') ? searchString.slice(1) : searchString
  const params = new URLSearchParams(query)

  let search = ''
  if (params.has('search')) {
    search = params.get('search').trim().slice(0, MAX_SEARCH_LENGTH)
  }

  let categoryId = ''
  if (params.has('categoryId')) {
    const rawCategory = params.get('categoryId').trim()
    if (/^[1-9]\d*$/.test(rawCategory)) {
      categoryId = rawCategory
    }
  }

  let sort = ''
  if (params.has('sort')) {
    const rawSort = params.get('sort').trim()
    if (ALLOWED_SORTS.has(rawSort)) {
      sort = rawSort
    }
  }

  let page = 1
  if (params.has('page')) {
    const rawPage = params.get('page').trim()
    if (/^[1-9]\d*$/.test(rawPage)) {
      page = Number(rawPage)
    }
  }

  return { search, categoryId, sort, page }
}

/**
 * Serializes state into browser URL query and backend API query.
 * Browser URL omits empty filters and page=1 for clean links.
 * API URL always includes valid query parameters and pagination.
 */
export function buildCatalogQuery({
  search = '',
  categoryId = '',
  sort = '',
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
} = {}) {
  const urlParams = new URLSearchParams()
  const apiParams = new URLSearchParams()

  const cleanSearch = String(search || '').trim().slice(0, MAX_SEARCH_LENGTH)
  if (cleanSearch) {
    urlParams.set('search', cleanSearch)
    apiParams.set('search', cleanSearch)
  }

  const cleanCategory = String(categoryId || '').trim()
  if (cleanCategory && /^[1-9]\d*$/.test(cleanCategory)) {
    urlParams.set('categoryId', cleanCategory)
    apiParams.set('categoryId', cleanCategory)
  }

  const cleanSort = String(sort || '').trim()
  if (cleanSort && ALLOWED_SORTS.has(cleanSort)) {
    urlParams.set('sort', cleanSort)
    apiParams.set('sort', cleanSort)
  }

  const validPage = Number.isInteger(page) && page > 1 ? page : 1
  if (validPage > 1) {
    urlParams.set('page', String(validPage))
  }
  apiParams.set('page', String(validPage))

  const validPageSize = Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 50
    ? pageSize
    : DEFAULT_PAGE_SIZE
  apiParams.set('pageSize', String(validPageSize))

  const urlQueryStr = urlParams.toString()
  const apiQueryStr = apiParams.toString()

  return {
    urlQuery: urlQueryStr ? `?${urlQueryStr}` : '',
    apiQuery: apiQueryStr ? `?${apiQueryStr}` : '',
  }
}

/**
 * Reads pagination metadata headers sent by backend GET /products (SCRUM-24).
 * Exposed in CORS via exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Page-Size', 'X-Total-Pages'].
 */
export function parsePaginationHeaders(headers, fallbackPageSize = DEFAULT_PAGE_SIZE) {
  const get = (key) => {
    if (!headers) return null
    if (typeof headers.get === 'function') return headers.get(key)
    return headers[key] ?? headers[key.toLowerCase()] ?? null
  }

  const total = Number(get('X-Total-Count') ?? 0)
  const page = Number(get('X-Page') ?? 1)
  const pageSize = Number(get('X-Page-Size') ?? fallbackPageSize)
  const totalPages = Number(
    get('X-Total-Pages') ?? (total > 0 ? Math.ceil(total / pageSize) : 0),
  )

  return {
    total: Number.isFinite(total) && total >= 0 ? total : 0,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : fallbackPageSize,
    totalPages: Number.isFinite(totalPages) && totalPages >= 0 ? totalPages : 0,
  }
}

/**
 * In-memory catalogue filter and sort matching the backend database behavior.
 * Used for deterministic fixture testing and fallback evaluation.
 * Note: Out-of-stock products are NEVER excluded.
 */
export function filterAndSortProducts(products, { search = '', categoryId = '', sort = '' } = {}) {
  if (!Array.isArray(products)) return []

  const cleanSearch = String(search || '').trim().toLowerCase()
  const targetCategory = categoryId ? Number(categoryId) : null

  // 1. Filter by category and search (matching name OR description)
  const filtered = products.filter((product) => {
    if (!product) return false

    // Category filter
    if (targetCategory !== null) {
      const prodCategory = product.categoryId ?? product.category_id
      if (prodCategory !== targetCategory) return false
    }

    // Search filter: case-insensitive match on name OR description
    if (cleanSearch) {
      const name = String(product.name || '').toLowerCase()
      const desc = String(product.description || '').toLowerCase()
      if (!name.includes(cleanSearch) && !desc.includes(cleanSearch)) {
        return false
      }
    }

    return true
  })

  // 2. Sort matching backend rules:
  // price_asc: price ASC, id ASC
  // price_desc: price DESC, id ASC
  // popularity: sold units DESC, id ASC
  // default: id ASC
  return filtered.slice().sort((a, b) => {
    const priceA = Number(a.price ?? 0)
    const priceB = Number(b.price ?? 0)
    const idA = Number(a.id ?? 0)
    const idB = Number(b.id ?? 0)

    if (sort === 'price_asc') {
      if (priceA !== priceB) return priceA - priceB
      return idA - idB
    }

    if (sort === 'price_desc') {
      if (priceA !== priceB) return priceB - priceA
      return idA - idB
    }

    if (sort === 'popularity') {
      const soldA = Number(a.unitsSold ?? a.units_sold ?? 0)
      const soldB = Number(b.unitsSold ?? b.units_sold ?? 0)
      if (soldA !== soldB) return soldB - soldA
      return idA - idB
    }

    return idA - idB
  })
}
