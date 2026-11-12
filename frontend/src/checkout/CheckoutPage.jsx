import { useState, useSyncExternalStore } from 'react'
import { useCart } from '../cart/cartContext.js'
import { formatMoney } from '../format.js'
import { submitCheckout } from './checkoutApi.js'
import { createCheckoutAttempt } from './checkoutAttempt.js'
import { ADDRESS_MAX_LENGTH, validateDeliveryAddress, validatePayment } from './checkoutValidation.js'

const EMPTY_CARD = { cardholderName: '', cardNumber: '', expiry: '', cvc: '' }

// Checkout for a signed-in customer (SCRUM-38). Not routed yet: mount at /checkout once
// SCRUM-18 adds routes. defaultAddress is the profile address once an endpoint provides it.
export default function CheckoutPage({ user, defaultAddress = '' }) {
  const cart = useCart()
  const [checkout] = useState(() => createCheckoutAttempt({ submitRequest: submitCheckout }))
  const attempt = useSyncExternalStore(checkout.subscribe, checkout.getState)

  if (user?.role !== 'customer') {
    return <CheckoutMessage title="Please sign in to check out">Your cart is kept while you sign in.</CheckoutMessage>
  }
  if (attempt.phase === 'succeeded') return <OrderConfirmation order={attempt.order} />
  if (cart.status === 'loading') return <CheckoutMessage title="Loading your cart..." />
  if (cart.status === 'error') {
    return <CheckoutMessage title="Your cart could not be loaded">{cart.error?.message}</CheckoutMessage>
  }
  if (cart.items.length === 0) return <CheckoutMessage title="Your cart is empty">Add a product to check out.</CheckoutMessage>

  return <CheckoutForm cart={cart} checkout={checkout} attempt={attempt} defaultAddress={defaultAddress} />
}

function CheckoutMessage({ title, children }) {
  return (
    <section className="checkout" aria-labelledby="checkout-title">
      <h1 id="checkout-title">{title}</h1>
      {children && <p>{children}</p>}
    </section>
  )
}

function CheckoutForm({ cart, checkout, attempt, defaultAddress }) {
  const [address, setAddress] = useState(defaultAddress ?? '')
  const [card, setCard] = useState(EMPTY_CARD)
  const [fieldErrors, setFieldErrors] = useState({})

  const blockedLines = cart.items.filter((item) => item.problem !== null)
  const mustReview = cart.needsReview || cart.merge.status === 'failed' || blockedLines.length > 0
  const busy = attempt.phase === 'submitting'
  // While the outcome is unknown the details must stay exactly as sent
  const locked = busy || attempt.phase === 'uncertain'

  function updateCard(field) {
    return (event) => setCard((current) => ({ ...current, [field]: event.target.value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (locked || mustReview) return
    const addressCheck = validateDeliveryAddress(address)
    const paymentCheck = validatePayment(card)
    const errors = { ...(paymentCheck.ok ? {} : paymentCheck.fields) }
    if (!addressCheck.ok) errors.deliveryAddress = addressCheck.error
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    refreshAfterSuccess(
      checkout.submit({
        expectedTotal: cart.subtotal,
        deliveryAddress: addressCheck.value,
        payment: paymentCheck.payment,
      }),
    )
  }

  // The server empties the cart when it creates the order; show that state everywhere
  function refreshAfterSuccess(promise) {
    promise.then(() => {
      if (checkout.getState().phase === 'succeeded') cart.refresh()
    })
  }

  async function handleReviewChangedCart() {
    await cart.refresh()
    checkout.edit()
  }

  const errorFor = (field) =>
    fieldErrors[field] && (
      <p className="field-error" id={`${field}-error`}>
        {fieldErrors[field]}
      </p>
    )
  const describedBy = (field) => (fieldErrors[field] ? `${field}-error` : undefined)

  return (
    <section className="checkout" aria-labelledby="checkout-title">
      <h1 id="checkout-title">Checkout</h1>

      <div className="checkout-summary">
        <h2>Your order</h2>
        <ul className="checkout-lines">
          {cart.items.map((item) => (
            <li key={item.productId}>
              <span>
                {item.name ?? `Product ${item.productId}`} × {item.quantity}
                {item.problem && <span className="field-error"> · Cannot be bought right now</span>}
              </span>
              <span>{formatMoney(item.lineTotal, item.currency)}</span>
            </li>
          ))}
        </ul>
        <p className="checkout-total">
          <span>Total confirmed by the store</span>
          <strong>{formatMoney(cart.subtotal, cart.currency)}</strong>
        </p>
        {mustReview && (
          <p className="checkout-alert" role="alert">
            Please review your cart before checkout: some items changed or could not be added.
          </p>
        )}
      </div>

      <form className="checkout-form" onSubmit={handleSubmit} noValidate>
        <fieldset disabled={locked}>
          <legend>Delivery</legend>
          <label htmlFor="deliveryAddress">Delivery address for this order</label>
          <textarea
            id="deliveryAddress"
            rows={3}
            maxLength={ADDRESS_MAX_LENGTH}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            aria-invalid={Boolean(fieldErrors.deliveryAddress)}
            aria-describedby={describedBy('deliveryAddress')}
            autoComplete="street-address"
          />
          {errorFor('deliveryAddress')}
        </fieldset>

        <fieldset disabled={locked}>
          <legend>Test payment</legend>
          <p className="test-payment-note">
            This is a mock payment for a university project. No money is charged. Do not enter a real card.
          </p>
          <label htmlFor="cardholderName">Name on card</label>
          <input
            id="cardholderName"
            value={card.cardholderName}
            onChange={updateCard('cardholderName')}
            aria-invalid={Boolean(fieldErrors.cardholderName)}
            aria-describedby={describedBy('cardholderName')}
            autoComplete="off"
          />
          {errorFor('cardholderName')}

          <label htmlFor="cardNumber">Test card number</label>
          <input
            id="cardNumber"
            inputMode="numeric"
            value={card.cardNumber}
            onChange={updateCard('cardNumber')}
            aria-invalid={Boolean(fieldErrors.cardNumber)}
            aria-describedby={describedBy('cardNumber')}
            autoComplete="off"
          />
          {errorFor('cardNumber')}

          <div className="checkout-row">
            <div>
              <label htmlFor="expiry">Expiry (MM/YY)</label>
              <input
                id="expiry"
                value={card.expiry}
                onChange={updateCard('expiry')}
                aria-invalid={Boolean(fieldErrors.expiry)}
                aria-describedby={describedBy('expiry')}
                autoComplete="off"
              />
              {errorFor('expiry')}
            </div>
            <div>
              <label htmlFor="cvc">Security code</label>
              <input
                id="cvc"
                inputMode="numeric"
                value={card.cvc}
                onChange={updateCard('cvc')}
                aria-invalid={Boolean(fieldErrors.cvc)}
                aria-describedby={describedBy('cvc')}
                autoComplete="off"
              />
              {errorFor('cvc')}
            </div>
          </div>
        </fieldset>

        <AttemptStatus
          attempt={attempt}
          checkout={checkout}
          onRetry={() => refreshAfterSuccess(checkout.retry())}
          onReviewCart={handleReviewChangedCart}
        />

        {attempt.phase !== 'uncertain' && (
          <button type="submit" className="checkout-submit" disabled={busy || mustReview}>
            {busy ? 'Placing your test order...' : 'Place test order'}
          </button>
        )}
      </form>
    </section>
  )
}

function AttemptStatus({ attempt, checkout, onRetry, onReviewCart }) {
  switch (attempt.phase) {
    case 'submitting':
      return <p className="checkout-status" role="status">Placing your test order. Please wait...</p>
    case 'uncertain':
      return (
        <div className="checkout-status checkout-status--warning" role="alert">
          <p>We could not confirm whether your order was placed. Checking again will not create a second order.</p>
          <button type="button" className="checkout-submit" onClick={onRetry}>
            Check again
          </button>
        </div>
      )
    case 'declined':
      return (
        <div className="checkout-status checkout-status--error" role="alert">
          <p>The test payment was declined. No order was placed and nothing was charged.</p>
          <button type="button" className="cart-notice-action" onClick={() => checkout.edit()}>
            Change payment details
          </button>
        </div>
      )
    case 'cartChanged':
      return (
        <div className="checkout-status checkout-status--error" role="alert">
          <p>Prices or stock changed since you opened checkout. No order was placed.</p>
          <button type="button" className="cart-notice-action" onClick={onReviewCart}>
            Review the updated order
          </button>
        </div>
      )
    case 'signedOut':
      return (
        <p className="checkout-status checkout-status--error" role="alert">
          Your session has ended. Please sign in again; your cart is kept.
        </p>
      )
    case 'invalid':
      return (
        <div className="checkout-status checkout-status--error" role="alert">
          <p>{attempt.error?.message ?? 'Some details are invalid.'}</p>
          <button type="button" className="cart-notice-action" onClick={() => checkout.edit()}>
            Edit details
          </button>
        </div>
      )
    default:
      return null
  }
}

// Shown only after the backend has confirmed the order
function OrderConfirmation({ order }) {
  return (
    <section className="checkout" aria-labelledby="checkout-title">
      <h1 id="checkout-title">Order #{order.id} placed</h1>
      <p role="status">Status: Processing. This was a test payment; no money was charged.</p>
      <div className="checkout-summary">
        <h2>Invoice details</h2>
        <ul className="checkout-lines">
          {order.items?.map((item) => (
            <li key={item.productId}>
              <span>{item.productName} × {item.quantity}</span>
              <span>{formatMoney(item.lineTotal, order.currency)}</span>
            </li>
          ))}
        </ul>
        <p className="checkout-total">
          <span>Total paid</span>
          <strong>{formatMoney(order.total, order.currency)}</strong>
        </p>
        <p>Delivery address: {order.deliveryAddress}</p>
        {order.cardLast4 && <p>Paid with test card ending {order.cardLast4}</p>}
      </div>
    </section>
  )
}
