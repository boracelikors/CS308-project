import { useCallback } from 'react'
import { formatDate, formatMoney } from '../format.js'
import { statusLabel } from './orderLogic.js'
import { fetchOrders } from './ordersApi.js'
import { OrdersMessage } from './OrdersMessage.jsx'
import { useAccountResource } from './useAccountResource.js'

// /orders for the signed-in customer (SCRUM-39). Not routed yet: mount once SCRUM-18 adds routes.
// user: { id, role } from the shared login state (SCRUM-27), or null
export default function OrderHistoryPage({ user }) {
  const key = user?.role === 'customer' ? `customer:${user.id}:orders` : null
  const load = useCallback((signal) => fetchOrders(signal), [])
  const orders = useAccountResource(key, load)

  if (key === null) return <OrdersMessage title="Please sign in to see your orders" />
  if (orders.status === 'loading') return <OrdersMessage title="Loading your orders..." live />
  if (orders.status === 'signedOut') return <OrdersMessage title="Your session has ended">Please sign in again.</OrdersMessage>
  if (orders.status !== 'ready') {
    return <OrdersMessage title="Your orders could not be loaded" onRetry={orders.reload} />
  }
  if (orders.data.length === 0) {
    return <OrdersMessage title="No orders yet">Orders you place will appear here.</OrdersMessage>
  }

  return (
    <section className="orders" aria-labelledby="orders-title">
      <h1 id="orders-title">Your orders</h1>
      <ul className="order-list">
        {orders.data.map((order) => (
          <li key={order.id}>
            <a className="order-row" href={`/orders/${order.id}`}>
              <span className="order-ref">Order #{order.id}</span>
              <span>{formatDate(order.createdAt)}</span>
              <span>{formatMoney(order.total, order.currency)}</span>
              <span className={`order-status order-status--${order.status}`}>{statusLabel(order.status)}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
