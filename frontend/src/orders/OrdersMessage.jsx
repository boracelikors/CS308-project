// Full-page message for the order pages: loading, empty, failure (with retry) and not-found states
export function OrdersMessage({ title, children, onRetry, live = false }) {
  return (
    <section className="orders" aria-labelledby="orders-message-title">
      <h1 id="orders-message-title" role={live ? 'status' : undefined}>
        {title}
      </h1>
      {children && <p>{children}</p>}
      {onRetry && (
        <button type="button" className="checkout-submit orders-retry" onClick={onRetry}>
          Try again
        </button>
      )}
    </section>
  )
}
