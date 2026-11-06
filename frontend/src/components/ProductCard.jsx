import { useState } from 'react'

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

  // Default soundwave icon
  return (
    <svg className="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 12h3l3-8 4 16 3-10 2 5 3-3h4" />
    </svg>
  )
}

/**
 * Reusable Product Card Component (SCRUM-9)
 *
 * Props:
 *  - product: Object containing { id, name, category, price, currency, description, image }
 */
export default function ProductCard({ product }) {
  const [imageError, setImageError] = useState(false)

  if (!product) {
    return null
  }

  const { name, category, price, currency = 'TRY', description, image } = product

  // Format price without rounding (preserves exact decimals e.g. 1999.99 -> 1.999,99)
  const formatPrice = (value) => {
    if (value === null || value === undefined) return ''
    const num = typeof value === 'number'
      ? value
      : (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)) ? Number(value) : null)

    if (num !== null) {
      return new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 20,
      }).format(num)
    }
    return value
  }

  const formattedPrice = formatPrice(price)

  const imageSrc = image
    ? (image.startsWith('http') || image.startsWith('/') ? image : `/images/${image}`)
    : null

  return (
    <article className="product-card" aria-label={name}>
      {/* 4. Image area with fallback placeholder */}
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
        {category && <span className="product-card-badge">{category}</span>}
      </div>

      {/* Card Details */}
      <div className="product-card-details">
        {/* 5. Product name below the image */}
        <h3 className="product-card-name" title={name}>
          {name}
        </h3>

        {description && (
          <p className="product-card-description">{description}</p>
        )}

        {/* 6. Price below the name */}
        <div className="product-card-price-row">
          <span className="product-card-price">
            {formattedPrice} <span className="currency">{currency}</span>
          </span>
        </div>
      </div>
    </article>
  )
}
