import { CATEGORIES, SORT_OPTIONS } from '../catalog/catalogQuery.js'

/**
 * Catalogue controls component: search input, category selector, sorting options, and reset filters.
 * Fully accessible with explicit labels, keyboard support and ARIA attributes (SCRUM-25).
 */
export default function CatalogControls({
  search = '',
  onSearchChange,
  categoryId = '',
  onCategoryChange,
  sort = '',
  onSortChange,
  onReset,
  totalCount = null,
  isLoading = false,
}) {
  const hasActiveFilters = Boolean(search.trim() || categoryId || sort)

  return (
    <div className="catalog-controls-container" aria-label="Catalogue filters and sorting">
      <form
        className="catalog-controls"
        role="search"
        onSubmit={(e) => e.preventDefault()}
      >
        {/* Search input with label and clear button */}
        <div className="catalog-control-group catalog-control-search">
          <label htmlFor="catalog-search" className="catalog-label">
            Search
          </label>
          <div className="search-input-wrap">
            <input
              id="catalog-search"
              type="search"
              className="catalog-input"
              placeholder="Search by name or description..."
              value={search}
              maxLength={100}
              autoComplete="off"
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search products by name or description"
            />
            {search && (
              <button
                type="button"
                className="catalog-clear-btn"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Category selector */}
        <div className="catalog-control-group">
          <label htmlFor="catalog-category" className="catalog-label">
            Category
          </label>
          <select
            id="catalog-category"
            className="catalog-select"
            value={categoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
            aria-label="Filter products by category"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={String(cat.id)}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sorting options */}
        <div className="catalog-control-group">
          <label htmlFor="catalog-sort" className="catalog-label">
            Sort by
          </label>
          <select
            id="catalog-sort"
            className="catalog-select"
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
            aria-label="Sort catalogue products"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Reset filters action */}
        {hasActiveFilters && (
          <div className="catalog-control-group catalog-control-reset">
            <button
              type="button"
              className="catalog-reset-btn"
              onClick={onReset}
              aria-label="Reset all search, category and sorting filters"
            >
              Reset filters
            </button>
          </div>
        )}
      </form>

      {/* Results summary / status indicator */}
      <div className="catalog-status-bar">
        <span className="catalog-count-text" role="status" aria-live="polite">
          {isLoading
            ? 'Updating results...'
            : totalCount !== null
              ? `${totalCount} ${totalCount === 1 ? 'product' : 'products'} found`
              : ''}
        </span>
      </div>
    </div>
  )
}
