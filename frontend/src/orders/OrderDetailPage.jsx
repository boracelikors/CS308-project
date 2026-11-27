import InvoicePanel from '../invoices/InvoicePanel.jsx'
import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { formatDate, formatMoney } from '../format.js'
import { deliverySteps, parseOrderId, statusLabel } from './orderLogic.js'
import { fetchOrder } from './ordersApi.js'
import { OrdersMessage } from './OrdersMessage.jsx'
import { useAccountResource } from './useAccountResource.js'

// orderIdParam is the raw URL segment for the signed-in customer’s order.
export default function OrderDetailPage({ user, orderIdParam }) {
  const orderId = parseOrderId(orderIdParam)
  const key = user?.role === 'customer' && orderId !== null ? `customer:${user.id}:order:${orderId}` : null
  const load = useCallback((signal) => fetchOrder(orderId, signal), [orderId])
  const order = useAccountResource(key, load)
  const backLink = (
    <Link className="orders-back" to="/orders">
      ← All orders
    </Link>
  )

  if (user?.role !== 'customer') return <OrdersMessage title="Please sign in to see this order" />
  if (orderId === null || order.status === 'notFound') {
    return (
      <OrdersMessage title="Order not found">
        This order does not exist or belongs to another account. {backLink}
      </OrdersMessage>
    )
  }
  if (order.status === 'loading') return <OrdersMessage title="Loading your order..." live />
  if (order.status === 'signedOut') return <OrdersMessage title="Your session has ended">Please sign in again.</OrdersMessage>
  if (order.status !== 'ready') return <OrdersMessage title="This order could not be loaded" onRetry={order.reload} />

  const { data } = order
  return (
    <section className="orders" aria-labelledby="order-title">
      {backLink}
      <h1 id="order-title">Order #{data.id}</h1>
      <p>
        Placed on {formatDate(data.createdAt)} ·{' '}
        <span className={`order-status order-status--${data.status}`}>{statusLabel(data.status)}</span>
      </p>

      <ol className="delivery-steps" aria-label="Delivery progress">
        {deliverySteps(data).map((step) => (
          <li
            key={step.status}
            className={step.done ? 'delivery-step delivery-step--done' : 'delivery-step'}
            aria-current={step.current ? 'step' : undefined}
          >
            <span>{step.label}</span>
            {step.done && step.at && <span className="delivery-step-date">{formatDate(step.at)}</span>}
          </li>
        ))}
      </ol>

      <div className="checkout-summary">
        <h2>Items</h2>
        <ul className="checkout-lines">
          {data.items.map((item) => (
            <li key={item.productId}>
              <span>
                <Link className="order-product-link" to={`/products/${item.productId}`}>{item.productName}</Link>{' '}× {item.quantity}
                <span className="order-unit-price"> ({formatMoney(item.unitPrice, data.currency)} each at purchase)</span>
              </span>
              <span>{formatMoney(item.lineTotal, data.currency)}</span>
            </li>
          ))}
        </ul>
        <p className="checkout-total">
          <span>Total paid</span>
          <strong>{formatMoney(data.total, data.currency)}</strong>
        </p>
      </div>

      <InvoicePanel userId={user.id} orderId={data.id} />
      <p>
        <strong>Delivery address:</strong> {data.deliveryAddress}
      </p>
    </section>
  )
}
