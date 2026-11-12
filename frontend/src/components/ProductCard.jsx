import { useState } from 'react'
import { useCart } from '../cart/cartContext.js'
import { formatPrice } from '../utils/formatPrice.js'

/**
 * Audio category visual icons for placeholder and card artwork
 */
function CategoryIcon({ category }) {
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
 * Reusable Product Card Component (SCRUM-9, SCRUM-25, SCRUM-30).
 * Displays full product details, exact decimal formatted price, and stock indicators.
 * Zero-stock products remain visible with disabled purchase action.
 */
export default function ProductCard({ product }) {
  const [imageError, setImageError] = useState(false)
  const [cartMessage, setCartMessage] = useState('')
  const cart = useCart()

  if (!product) {
    return null
  }

  const { id, name, category, price, currency = 'TRY', description, image } = product

  const formattedPrice = formatPrice(price)

  // Stock status checks from backend fields (quantityInStock, inStock, stock)
  const isOutOfStock =
    product.inStock === false ||
    (typeof product.quantityInStock === 'number' && product.quantityInStock <= 0) ||
    (typeof product.stock === 'number' && product.stock <= 0)

  const stockCount =
    typeof product.quantityInStock === 'number'
      ? product.quantityInStock
      : typeof product.stock === 'number'
        ? product.stock
        : null

  const isLowStock = !isOutOfStock && stockCount !== null && stockCount > 0 && stockCount <= 3

  async function handleAddToCart() {
    if (isOutOfStock) return
    const result = await cart.add(id)
    setCartMessage(result.ok ? 'Added to cart' : result.message)
  }

  const imageSrc = image
    ? image.startsWith('http') || image.startsWith('/')
      ? image
      : `/images/${image}`
    : null

  return (
    <article
      className={`product-card ${isOutOfStock ? 'product-card--out-of-stock' : ''}`}
      aria-label={`${name} - ${formattedPrice} ${currency}${isOutOfStock ? ' (Out of stock)' : ''}`}
    >
      {/* Image area with fallback placeholder and badges */}
      <div className="product-card-image-wrap">
        {imageSrc && !imageError ? (
          <img
            src={imageSrc}
            alt={name}
            className="product-card-image"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="product-card-placeholder" aria-hidden="true">
            <CategoryIcon category={category} />
            <span className="placeholder-category">{category || 'Audio'}</span>
          </div>
        )}

        <div className="product-card-badges">
          {category && <span className="product-card-badge">{category}</span>}
          {isOutOfStock && (
            <span className="product-stock-badge product-stock-badge--out">Out of stock</span>
          )}
          {isLowStock && (
            <span className="product-stock-badge product-stock-badge--low">
              Only {stockCount} left
            </span>
          )}
        </div>
      </div>

      {/* Card Details */}
      <div className="product-card-details">
        <h3 className="product-card-name" title={name}>
          <a href={`/products/${id}`} className="product-card-link">
            {name}
          </a>
        </h3>

        {description && <p className="product-card-description">{description}</p>}

        {/* Stock status announcement */}
        <div className="product-card-stock-status">
          {isOutOfStock ? (
            <span className="stock-label stock-label--out">Out of stock</span>
          ) : stockCount !== null ? (
            <span className="stock-label stock-label--available">
              {isLowStock ? `Low stock (${stockCount} left)` : 'In stock'}
            </span>
          ) : null}
        </div>

        {/* Price display with exact formatting */}
        <div className="product-card-price-row">
          <span className="product-card-price">
            {formattedPrice} <span className="currency">{currency}</span>
          </span>
        </div>

        <button
          type="button"
          className="add-to-cart"
          onClick={handleAddToCart}
          disabled={isOutOfStock || cart.status === 'loading'}
          aria-label={isOutOfStock ? `${name} is out of stock` : `Add ${name} to cart`}
        >
          {isOutOfStock ? 'Out of stock' : 'Add to cart'}
        </button>
        <p className="add-to-cart-message" role="status">
          {cartMessage}
        </p>
      </div>
    </article>
  )
}
