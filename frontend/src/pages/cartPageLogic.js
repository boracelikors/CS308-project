// Pure logic and checkout validations for the shopping cart page (SCRUM-31).
// Pure functions without React/DOM dependencies for deterministic unit testing.
import { formatPrice } from '../utils/formatPrice.js'

/**
 * Checks whether the cart can proceed to checkout.
 * Blocked when cart is empty, loading, or has unavailable/out-of-stock items.
 */
export function canProceedToCheckout(items = [], status = 'ready') {
  if (status !== 'ready') {
    return { allowed: false, reason: 'The cart is currently updating.' }
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { allowed: false, reason: 'Your cart is empty.' }
  }

  const problemItem = items.find((item) => item.problem !== null && item.problem !== undefined)
  if (problemItem) {
    return {
      allowed: false,
      reason: 'Please remove or adjust unavailable items before proceeding to checkout.',
    }
  }

  return { allowed: true }
}

/**
 * Returns user-friendly message for a cart line problem.
 */
export function describeProblem(problem, stock = null) {
  switch (problem) {
    case 'OUT_OF_STOCK':
      return 'This product is out of stock. Please remove it to proceed.'
    case 'INSUFFICIENT_STOCK':
      return typeof stock === 'number'
        ? `Only ${stock} left in stock. Please reduce the quantity.`
        : 'Not enough stock available. Please reduce the quantity.'
    case 'UNAVAILABLE':
      return 'This product is no longer available. Please remove it.'
    default:
      return null
  }
}

/**
 * Determines checkout destination based on auth mode (guest vs customer).
 * Guests are directed to login with a safe return path.
 */
export function getCheckoutDestination(mode, returnUrl = '/cart') {
  if (mode === 'guest') {
    const encodedReturn = encodeURIComponent(returnUrl)
    return {
      url: `/login?returnUrl=${encodedReturn}`,
      isGuest: true,
      label: 'Sign in to Checkout',
    }
  }

  return {
    url: '/checkout',
    isGuest: false,
    label: 'Proceed to Checkout',
  }
}

/**
 * Formats subtotal display string.
 */
export function formatCartTotal(subtotal, currency = 'TRY') {
  if (subtotal === null || subtotal === undefined || subtotal === '') {
    return `0 ${currency}`
  }
  return `${formatPrice(subtotal)} ${currency}`
}
