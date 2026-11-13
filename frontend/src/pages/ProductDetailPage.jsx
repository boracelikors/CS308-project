import { useCallback, useEffect, useState } from 'react'
import { useCart } from '../cart/cartContext.js'
import { formatPrice } from '../utils/formatPrice.js'
import {
  computeRemainingAllowed,
  getProductStock,
  validateQuantity,
} from './productDetailLogic.js'

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:3001'

/**
 * Audio category visual icons for fallback artwork
 */
function DetailCategoryIcon({ category }) {
  const normCategory = (category || '').toLowerCase()

  if (normCategory.includes('speaker')) {
    return (
      <svg className="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <circle cx="12" cy="7" r="2" />
        <circle cx="12" cy="15" r="4" />
      </svg>
    )
  }

  if (normCategory.includes('soundbar')) {
    return (
      <svg className="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="9" width="20" height="6" rx="2" />
        <circle cx="6" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="18" cy="12" r="1" fill="currentColor" />
      </svg>
    )
  }

  if (normCategory.includes('subwoofer')) {
    return (
      <svg className="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    )
  }

  if (normCategory.includes('mic')) {
    return (
      <svg className="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="9" y="2" width="6" height="11" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0" />
        <line x1="12" y1="17" x2="12" y2="21" />
        <line x1="8" y1="21" x2="16" y2="21" />
      </svg>
    )
  }

  if (normCategory.includes('headphone')) {
    return (
      <svg className="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
      </svg>
    )
  }

  if (normCategory.includes('dj') || normCategory.includes('controller')) {
    return (
      <svg className="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <circle cx="7" cy="12" r="3" />
        <circle cx="17" cy="12" r="3" />
        <line x1="12" y1="8" x2="12" y2="16" />
      </svg>
    )
  }

  return (
    <svg className="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 12h3l3-8 4 16 3-10 2 5 3-3h4" />
    </svg>
  )
}

/**
 * Product Detail Page (SCRUM-30).
 * Displays full product specifications (R9), stock status, and a stock-aware quantity selector.
 */
export default function ProductDetailPage({ productId }) {
  const [product, setProduct] = useState(null)
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'not-found' | 'error'
  const [errorMessage, setErrorMessage] = useState('')
  const [imageError, setImageError] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error', message: string }

  const cart = useCart()

  const [reloadKey, setReloadKey] = useState(0)

  // Load product from backend GET /products/:id
  useEffect(() => {
    let cancelled = false

    async function fetchDetail() {
      setStatus('loading')
      setErrorMessage('')
      setFeedback(null)
      setImageError(false)

      try {
        const response = await fetch(`${API_BASE_URL}/products/${productId}`)
        if (response.status === 404) {
          if (!cancelled) setStatus('not-found')
          return
        }

        if (!response.ok) {
          throw new Error(`GET /products/${productId} responded with ${response.status}`)
        }

        const data = await response.json()
        if (!data || !data.product) {
          if (!cancelled) setStatus('not-found')
          return
        }

        if (!cancelled) {
          setProduct(data.product)
          setStatus('ready')
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load product detail:', err)
          setErrorMessage('Could not load product details. Please check your connection and try again.')
          setStatus('error')
        }
      }
    }

    fetchDetail()
    return () => {
      cancelled = true
    }
  }, [productId, reloadKey])

  const handleRetry = useCallback(() => {
    setReloadKey((k) => k + 1)
  }, [])

  // Scroll to top on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
    }
  }, [productId])

  if (status === 'loading') {
    return (
      <div className="product-detail-page">
        <div className="product-status" role="status">
          <p>Loading product details...</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="product-detail-page">
        <div className="product-status product-status--error" role="alert">
          <p>{errorMessage}</p>
          <button type="button" className="catalog-retry-btn" onClick={handleRetry}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (status === 'not-found' || !product) {
    return (
      <div className="product-detail-page">
        <div className="product-not-found" role="alert">
          <h2>Product Not Found</h2>
          <p>
            The product you requested (ID: {productId}) does not exist or has been removed from sale.
          </p>
          <a href="/" className="collection-link">
            ← Return to catalogue
          </a>
        </div>
      </div>
    )
  }

  const {
    id,
    name,
    category,
    model,
    serialNumber,
    description,
    price,
    currency = 'TRY',
    warrantyStatus,
    distributor,
    image,
  } = product

  const formattedPrice = formatPrice(price)
  const { stock, isOutOfStock, isLowStock } = getProductStock(product)
  const inCartCount = cart.quantityOf(id)
  const maxAddable = computeRemainingAllowed(product, inCartCount)

  const handleQuantityInputChange = (e) => {
    const rawVal = e.target.value
    if (rawVal === '') {
      setQuantity('')
      return
    }
    const check = validateQuantity(rawVal, maxAddable)
    setQuantity(check.value)
  }

  const handleQuantityStep = (delta) => {
    const nextVal = (typeof quantity === 'number' ? quantity : 1) + delta
    const check = validateQuantity(nextVal, maxAddable)
    if (check.ok) {
      setQuantity(check.value)
    }
  }

  const handleAddToCart = async () => {
    const qtyCheck = validateQuantity(quantity, maxAddable)
    if (!qtyCheck.ok) {
      setFeedback({ type: 'error', message: qtyCheck.error })
      return
    }

    const result = await cart.add(id, qtyCheck.value)
    if (result.ok) {
      setFeedback({
        type: 'success',
        message: `Added ${qtyCheck.value} × ${name} to your cart.`,
      })
      // Reset input to 1 or maxAddable after successful addition
      const nextRemaining = computeRemainingAllowed(product, inCartCount + qtyCheck.value)
      setQuantity(nextRemaining > 0 ? 1 : 0)
    } else {
      setFeedback({
        type: 'error',
        message: result.message || 'Could not add product to cart. Please try again.',
      })
    }
  }

  const imageSrc = image
    ? image.startsWith('http') || image.startsWith('/')
      ? image
      : `/images/${image}`
    : null

  return (
    <div className="product-detail-page">
      {/* Breadcrumb Navigation */}
      <nav className="detail-breadcrumb" aria-label="Breadcrumb">
        <a href="/" className="detail-back-link">
          ← Back to collection
        </a>
      </nav>

      <article className="product-detail-layout" aria-labelledby="detail-title">
        {/* Left Column: Image Area */}
        <div className="detail-media">
          <div className="detail-image-wrap">
            {imageSrc && !imageError ? (
              <img
                src={imageSrc}
                alt={name}
                className="detail-image"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="detail-placeholder" aria-hidden="true">
                <DetailCategoryIcon category={category} />
                <span className="placeholder-category">{category || 'Audio Equipment'}</span>
              </div>
            )}

            <div className="detail-badges">
              {category && <span className="product-card-badge">{category}</span>}
              {isOutOfStock && (
                <span className="product-stock-badge product-stock-badge--out">Out of stock</span>
              )}
              {isLowStock && (
                <span className="product-stock-badge product-stock-badge--low">
                  Only {stock} left
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Information & Actions */}
        <div className="detail-info">
          <p className="detail-category eyebrow">{category}</p>
          <h1 id="detail-title" className="detail-title">
            {name}
          </h1>

          <div className="detail-price-box">
            <span className="detail-price">
              {formattedPrice} <span className="currency">{currency}</span>
            </span>
          </div>

          <div className="detail-description-section">
            <h2 className="detail-section-title">Overview</h2>
            <p className="detail-description">{description}</p>
          </div>

          {/* Full R9 Product Specifications */}
          <div className="detail-specs-section">
            <h2 className="detail-section-title">Specifications</h2>
            <dl className="specs-list">
              <div className="spec-row">
                <dt className="spec-label">Category</dt>
                <dd className="spec-value">{category}</dd>
              </div>
              <div className="spec-row">
                <dt className="spec-label">Model</dt>
                <dd className="spec-value">{model || '—'}</dd>
              </div>
              <div className="spec-row">
                <dt className="spec-label">Serial Number</dt>
                <dd className="spec-value">{serialNumber || '—'}</dd>
              </div>
              <div className="spec-row">
                <dt className="spec-label">Stock Status</dt>
                <dd className={`spec-value ${isOutOfStock ? 'spec-value--out' : ''}`}>
                  {isOutOfStock
                    ? 'Out of stock'
                    : stock !== null
                      ? `${stock} units available`
                      : 'In stock'}
                </dd>
              </div>
              <div className="spec-row">
                <dt className="spec-label">Warranty</dt>
                <dd className="spec-value">{warrantyStatus || '—'}</dd>
              </div>
              <div className="spec-row">
                <dt className="spec-label">Distributor</dt>
                <dd className="spec-value">{distributor || '—'}</dd>
              </div>
            </dl>
          </div>

          {/* Purchase Actions & Quantity Selector */}
          <div className="detail-purchase-section">
            {isOutOfStock ? (
              <div className="stock-alert stock-alert--out" role="status">
                <p>This product is currently out of stock and cannot be added to the cart.</p>
                <button type="button" className="add-to-cart-btn" disabled>
                  Out of stock
                </button>
              </div>
            ) : (
              <div className="purchase-controls">
                <div className="quantity-control-group">
                  <label htmlFor="product-quantity-input" className="quantity-label">
                    Quantity
                  </label>
                  <div className="quantity-stepper">
                    <button
                      type="button"
                      className="quantity-step-btn"
                      onClick={() => handleQuantityStep(-1)}
                      disabled={Number(quantity) <= 1}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <input
                      id="product-quantity-input"
                      type="number"
                      className="quantity-input"
                      value={quantity}
                      min={1}
                      max={maxAddable}
                      step={1}
                      onChange={handleQuantityInputChange}
                      aria-label="Product purchase quantity"
                    />
                    <button
                      type="button"
                      className="quantity-step-btn"
                      onClick={() => handleQuantityStep(1)}
                      disabled={Number(quantity) >= maxAddable}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  {inCartCount > 0 && (
                    <span className="cart-existing-note">
                      ({inCartCount} already in your cart)
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="add-to-cart-btn"
                  onClick={handleAddToCart}
                  disabled={cart.status === 'loading' || maxAddable <= 0}
                >
                  {maxAddable <= 0 ? 'Max in cart' : 'Add to cart'}
                </button>
              </div>
            )}

            {/* Action Feedback Announcements */}
            {feedback && (
              <div
                className={`detail-feedback detail-feedback--${feedback.type}`}
                role={feedback.type === 'error' ? 'alert' : 'status'}
                aria-live="polite"
              >
                {feedback.message}
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  )
}
