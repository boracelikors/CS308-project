import { useState } from 'react'
import { useCart } from '../cart/cartContext.js'
import { formatPrice } from '../utils/formatPrice.js'
import {
  canProceedToCheckout,
  describeProblem,
  formatCartTotal,
  getCheckoutDestination,
} from './cartPageLogic.js'

/**
 * Audio category visual icons for cart placeholder artwork
 */
function CartItemPlaceholder() {
  return (
    <div className="cart-item-placeholder" aria-hidden="true">
      <svg className="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 12h3l3-8 4 16 3-10 2 5 3-3h4" />
      </svg>
    </div>
  )
}

/**
 * Shopping Cart Page (SCRUM-31).
 * Displays line items, quantity controls, removal, subtotal, and stock alerts.
 * Works uniformly for both guest (localStorage) and authenticated customer carts.
 */
export default function CartPage() {
  const cart = useCart()
  const { mode, status, items, subtotal, currency = 'TRY', error } = cart

  // Local state for tracking line updates in progress to prevent duplicate clicks
  const [busyProductId, setBusyProductId] = useState(null)
  const [actionError, setActionError] = useState(null)

  const checkoutCheck = canProceedToCheckout(items, status)
  const checkoutDest = getCheckoutDestination(mode, '/cart')

  const handleQuantityStep = async (item, delta) => {
    const nextQty = item.quantity + delta
    if (nextQty < 1) {
      // Stepping below 1 triggers removal
      handleRemove(item.productId)
      return
    }

    setBusyProductId(item.productId)
    setActionError(null)

    const result = await cart.setQuantity(item.productId, nextQty)
    setBusyProductId(null)

    if (!result.ok) {
      setActionError({
        productId: item.productId,
        message: result.message || 'Quantity could not be updated.',
      })
    }
  }

  const handleQuantityInputBlur = async (item, e) => {
    const val = Number(e.target.value.trim())
    if (!Number.isInteger(val) || val < 1) {
      // Reset input to current valid quantity
      e.target.value = item.quantity
      return
    }

    if (val === item.quantity) return

    setBusyProductId(item.productId)
    setActionError(null)

    const result = await cart.setQuantity(item.productId, val)
    setBusyProductId(null)

    if (!result.ok) {
      setActionError({
        productId: item.productId,
        message: result.message || 'Quantity could not be updated.',
      })
      // Reset input to current state
      e.target.value = item.quantity
    }
  }

  const handleRemove = async (productId) => {
    setBusyProductId(productId)
    setActionError(null)

    const result = await cart.remove(productId)
    setBusyProductId(null)

    if (!result.ok) {
      setActionError({
        productId,
        message: result.message || 'Item could not be removed.',
      })
    }
  }

  // Loading state
  if (status === 'loading') {
    return (
      <div className="cart-page">
        <h1 className="cart-page-title">Your Cart</h1>
        <div className="product-status" role="status">
          <p>Loading your shopping cart...</p>
        </div>
      </div>
    )
  }

  // Global cart error state
  if (status === 'error' && items.length === 0) {
    return (
      <div className="cart-page">
        <h1 className="cart-page-title">Your Cart</h1>
        <div className="product-status product-status--error" role="alert">
          <p>{error?.message || 'Could not load your cart. Please try again later.'}</p>
          <a href="/#products" className="collection-link">
            Return to catalogue
          </a>
        </div>
      </div>
    )
  }

  // Empty cart state
  if (items.length === 0) {
    return (
      <div className="cart-page">
        <h1 className="cart-page-title">Your Cart</h1>
        <div className="cart-empty-panel" role="status">
          <span className="cart-empty-icon" aria-hidden="true">🛒</span>
          <h2>Your cart is currently empty</h2>
          <p>Explore our high-end audio collection and find your sound.</p>
          <a href="/#products" className="collection-link">
            Explore the collection <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="cart-page">
      <div className="cart-header-row">
        <h1 className="cart-page-title">Your Cart</h1>
        <a href="/#products" className="continue-shopping-link">
          ← Continue shopping
        </a>
      </div>

      {/* Global Action Error Banner */}
      {actionError && (
        <div className="cart-alert cart-alert--error" role="alert">
          <p>{actionError.message}</p>
          <button
            type="button"
            className="cart-alert-close"
            onClick={() => setActionError(null)}
            aria-label="Close error message"
          >
            ×
          </button>
        </div>
      )}

      {/* Guest Mode Notice */}
      {mode === 'guest' && (
        <div className="cart-guest-banner" role="note">
          <p>
            You are shopping as a <strong>guest</strong>. Your cart will be saved on this device.
            Sign in before checkout to save your order to your account.
          </p>
        </div>
      )}

      <div className="cart-layout">
        {/* Left Column: Cart Items List */}
        <div className="cart-items-section">
          <ul className="cart-items-list" aria-label="Shopping cart items">
            {items.map((item) => {
              const isBusy = busyProductId === item.productId
              const hasProblem = Boolean(item.problem)
              const problemText = describeProblem(item.problem, item.stock)
              const imageSrc = item.image
                ? item.image.startsWith('http') || item.image.startsWith('/')
                  ? item.image
                  : `/images/${item.image}`
                : null

              return (
                <li
                  key={item.productId}
                  className={`cart-item-row ${hasProblem ? 'cart-item-row--problem' : ''}`}
                >
                  {/* Thumbnail */}
                  <div className="cart-item-media">
                    <a
                      href={`/products/${item.productId}`}
                      aria-label={`View details for ${item.name || 'product'}`}
                    >
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={item.name || 'Product thumbnail'}
                          className="cart-item-image"
                        />
                      ) : (
                        <CartItemPlaceholder />
                      )}
                    </a>
                  </div>

                  {/* Details */}
                  <div className="cart-item-info">
                    <h2 className="cart-item-name">
                      <a href={`/products/${item.productId}`}>
                        {item.name || `Product #${item.productId}`}
                      </a>
                    </h2>

                    <div className="cart-item-unit-price">
                      {item.unitPrice ? (
                        <>
                          {formatPrice(item.unitPrice)}{' '}
                          <span className="currency">{item.currency || currency}</span>
                        </>
                      ) : (
                        <span className="price-unavailable">Price unavailable</span>
                      )}
                    </div>

                    {/* Problem Warning Badge */}
                    {hasProblem && (
                      <div className="cart-item-problem-badge" role="alert">
                        <span className="problem-icon" aria-hidden="true">⚠</span> {problemText}
                      </div>
                    )}
                  </div>

                  {/* Quantity Stepper & Removal */}
                  <div className="cart-item-actions">
                    <div className="cart-quantity-stepper">
                      <button
                        type="button"
                        className="quantity-step-btn"
                        onClick={() => handleQuantityStep(item, -1)}
                        disabled={isBusy || hasProblem}
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        className="quantity-input"
                        defaultValue={item.quantity}
                        key={item.quantity} // Re-render when item.quantity changes from server
                        min={1}
                        max={item.stock ?? 999}
                        disabled={isBusy || hasProblem}
                        onBlur={(e) => handleQuantityInputBlur(item, e)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur()
                          }
                        }}
                        aria-label={`Quantity of ${item.name}`}
                      />
                      <button
                        type="button"
                        className="quantity-step-btn"
                        onClick={() => handleQuantityStep(item, 1)}
                        disabled={
                          isBusy ||
                          hasProblem ||
                          (typeof item.stock === 'number' && item.quantity >= item.stock)
                        }
                        aria-label={`Increase quantity of ${item.name}`}
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      className="cart-remove-btn"
                      onClick={() => handleRemove(item.productId)}
                      disabled={isBusy}
                      aria-label={`Remove ${item.name} from cart`}
                    >
                      {isBusy ? 'Removing...' : 'Remove'}
                    </button>
                  </div>

                  {/* Line Total */}
                  <div className="cart-item-total">
                    {item.lineTotal ? (
                      <span className="line-total-price">
                        {formatPrice(item.lineTotal)}{' '}
                        <span className="currency">{item.currency || currency}</span>
                      </span>
                    ) : (
                      <span className="line-total-excluded">—</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Right Column: Order Summary */}
        <div className="cart-summary-section">
          <div className="cart-summary-card">
            <h2 className="cart-summary-title">Order Summary</h2>

            <div className="summary-row">
              <span className="summary-label">Items ({items.reduce((s, i) => s + i.quantity, 0)})</span>
              <span className="summary-value">{formatCartTotal(subtotal, currency)}</span>
            </div>

            <div className="summary-row">
              <span className="summary-label">Shipping</span>
              <span className="summary-value summary-value--free">Calculated at checkout</span>
            </div>

            <div className="summary-row summary-row--total">
              <span className="summary-label">Subtotal</span>
              <span className="summary-value total-value">
                {formatCartTotal(subtotal, currency)}
              </span>
            </div>

            {/* Checkout validation notice */}
            {!checkoutCheck.allowed && (
              <p className="checkout-block-reason" role="alert">
                {checkoutCheck.reason}
              </p>
            )}

            {/* Checkout Button */}
            <a
              href={checkoutCheck.allowed ? checkoutDest.url : '#'}
              className={`checkout-btn ${!checkoutCheck.allowed ? 'checkout-btn--disabled' : ''}`}
              aria-disabled={!checkoutCheck.allowed}
              onClick={(e) => {
                if (!checkoutCheck.allowed) {
                  e.preventDefault()
                }
              }}
            >
              {checkoutDest.label} →
            </a>

            <p className="summary-tax-note">Taxes and shipping calculated at checkout.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
