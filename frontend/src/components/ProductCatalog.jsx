import { useCallback, useEffect, useRef, useState } from 'react'
import CatalogControls from './CatalogControls.jsx'
import ProductList from './ProductList.jsx'
import {
  DEFAULT_PAGE_SIZE,
  buildCatalogQuery,
  parseCatalogParams,
  parsePaginationHeaders,
} from '../catalog/catalogQuery.js'

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:3001'

export default function ProductCatalog() {
  // Read initial parameters from browser URL
  const initialParams = typeof window !== 'undefined'
    ? parseCatalogParams(window.location.search)
    : { search: '', categoryId: '', sort: '', page: 1 }

  const [searchInput, setSearchInput] = useState(initialParams.search)
  const [filters, setFilters] = useState({
    search: initialParams.search,
    categoryId: initialParams.categoryId,
    sort: initialParams.sort,
    page: initialParams.page,
  })

  const [products, setProducts] = useState([])
  const [pagination, setPagination] = useState({
    total: 0,
    page: initialParams.page,
    pageSize: DEFAULT_PAGE_SIZE,
    totalPages: 0,
  })
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [errorMessage, setErrorMessage] = useState('')

  const activeFetchIdRef = useRef(0)
  const abortControllerRef = useRef(null)
  const debounceTimerRef = useRef(null)

  // Synchronize state changes to URL query parameters
  const updateUrl = useCallback((newFilters, replace = false) => {
    if (typeof window === 'undefined') return
    const { urlQuery } = buildCatalogQuery({
      search: newFilters.search,
      categoryId: newFilters.categoryId,
      sort: newFilters.sort,
      page: newFilters.page,
      pageSize: DEFAULT_PAGE_SIZE,
    })
    const targetUrl = `${window.location.pathname}${urlQuery}${window.location.hash}`
    if (replace) {
      window.history.replaceState(null, '', targetUrl)
    } else {
      window.history.pushState(null, '', targetUrl)
    }
  }, [])

  // Main fetch function: calls real GET /products with combined parameters
  const fetchProducts = useCallback(async (currentFilters) => {
    // Cancel any previous pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    const fetchId = ++activeFetchIdRef.current
    setStatus('loading')
    setErrorMessage('')

    const { apiQuery } = buildCatalogQuery({
      search: currentFilters.search,
      categoryId: currentFilters.categoryId,
      sort: currentFilters.sort,
      page: currentFilters.page,
      pageSize: DEFAULT_PAGE_SIZE,
    })

    try {
      const response = await fetch(`${API_BASE_URL}/products${apiQuery}`, {
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Catalogue request failed with status ${response.status}`)
      }

      const data = await response.json()
      const paginationMeta = parsePaginationHeaders(response.headers, DEFAULT_PAGE_SIZE)

      // Guard against stale responses: only apply if this request is still the newest
      if (fetchId === activeFetchIdRef.current) {
        setProducts(Array.isArray(data) ? data : [])
        setPagination({
          total: paginationMeta.total,
          page: paginationMeta.page || currentFilters.page,
          pageSize: paginationMeta.pageSize,
          totalPages: paginationMeta.totalPages,
        })
        setStatus('ready')
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Ignored: request was superseded by a newer one
        return
      }
      if (fetchId === activeFetchIdRef.current) {
        console.error('Failed to load catalogue products:', err)
        setErrorMessage('Products could not be loaded. Please check your connection and try again.')
        setStatus('error')
      }
    }
  }, [])

  // Listen for browser Back/Forward (popstate) navigation
  useEffect(() => {
    function handlePopState() {
      const parsed = parseCatalogParams(window.location.search)
      setSearchInput(parsed.search)
      setFilters(parsed)
      fetchProducts(parsed)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [fetchProducts])

  // Trigger initial fetch on mount
  useEffect(() => {
    fetchProducts(filters)
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounce search input typing (300ms)
  const handleSearchChange = (value) => {
    setSearchInput(value)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

    debounceTimerRef.current = setTimeout(() => {
      const newFilters = {
        ...filters,
        search: value.trim(),
        page: 1, // Reset to page 1 on search change
      }
      setFilters(newFilters)
      updateUrl(newFilters, true) // Replace state while typing to avoid polluting history
      fetchProducts(newFilters)
    }, 300)
  }

  // Handle immediate filter change for Category (resets page to 1)
  const handleCategoryChange = (categoryId) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    const newFilters = {
      ...filters,
      categoryId,
      page: 1, // Reset to page 1 on filter change
    }
    setFilters(newFilters)
    updateUrl(newFilters, false)
    fetchProducts(newFilters)
  }

  // Handle immediate filter change for Sorting (resets page to 1)
  const handleSortChange = (sort) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    const newFilters = {
      ...filters,
      sort,
      page: 1, // Reset to page 1 on sort change
    }
    setFilters(newFilters)
    updateUrl(newFilters, false)
    fetchProducts(newFilters)
  }

  // Handle pagination page change
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage === filters.page || (pagination.totalPages && newPage > pagination.totalPages)) {
      return
    }
    const newFilters = {
      ...filters,
      page: newPage,
    }
    setFilters(newFilters)
    updateUrl(newFilters, false)
    fetchProducts(newFilters)
    // Smooth scroll to collection top on page navigation
    const target = document.getElementById('products')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Reset all filters to default state (page 1, empty search, all categories, default sort)
  const handleResetFilters = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    setSearchInput('')
    const defaultFilters = {
      search: '',
      categoryId: '',
      sort: '',
      page: 1,
    }
    setFilters(defaultFilters)
    updateUrl(defaultFilters, false)
    fetchProducts(defaultFilters)
  }

  return (
    <div className="catalogue-wrapper">
      {/* 1. Filter and sorting controls */}
      <CatalogControls
        search={searchInput}
        onSearchChange={handleSearchChange}
        categoryId={filters.categoryId}
        onCategoryChange={handleCategoryChange}
        sort={filters.sort}
        onSortChange={handleSortChange}
        onReset={handleResetFilters}
        totalCount={status === 'ready' ? pagination.total : null}
        isLoading={status === 'loading'}
      />

      {/* 2. Loading state */}
      {status === 'loading' && (
        <div className="product-status" role="status">
          <p>Loading catalogue products...</p>
        </div>
      )}

      {/* 3. Error state with retry action */}
      {status === 'error' && (
        <div className="product-status product-status--error" role="alert">
          <p>{errorMessage}</p>
          <button
            type="button"
            className="catalog-retry-btn"
            onClick={() => fetchProducts(filters)}
          >
            Try again
          </button>
        </div>
      )}

      {/* 4. Ready state */}
      {status === 'ready' && (
        <>
          {products.length === 0 ? (
            <div className="catalog-no-results" role="status">
              <h3>No products found</h3>
              <p>
                We could not find any products matching your current search or filter criteria.
              </p>
              <button
                type="button"
                className="catalog-reset-btn"
                onClick={handleResetFilters}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <ProductList products={products} />
          )}

          {/* 5. Pagination controls */}
          {pagination.totalPages > 1 && (
            <nav className="catalog-pagination" aria-label="Catalogue pagination">
              <button
                type="button"
                className="pagination-btn pagination-prev"
                onClick={() => handlePageChange(filters.page - 1)}
                disabled={filters.page <= 1}
                aria-label="Previous page"
              >
                ← Previous
              </button>

              <span className="pagination-info" aria-current="page">
                Page {filters.page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                className="pagination-btn pagination-next"
                onClick={() => handlePageChange(filters.page + 1)}
                disabled={filters.page >= pagination.totalPages}
                aria-label="Next page"
              >
                Next →
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
