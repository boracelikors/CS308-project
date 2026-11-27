import { useCallback, useRef, useState } from 'react'
import { apiRequest } from '../api/request.js'
import { useSession } from '../auth/context.js'
import { useAccountResource } from '../orders/useAccountResource.js'
import { formatDate, formatMoney } from '../format.js'
import { statusLabel } from '../orders/orderLogic.js'
import ManagerNav from './ManagerNav.jsx'

const nextDelivery = {
  processing: { status: 'in_transit', label: 'Mark in transit' },
  in_transit: { status: 'delivered', label: 'Mark delivered' },
}

function DeliveryList({ rows, active, update, locked }) {
  const grouped = new Map()
  for (const row of rows) {
    if (!grouped.has(row.orderId)) grouped.set(row.orderId, [])
    grouped.get(row.orderId).push(row)
  }
  return (
    <ul className="manager-list">
      {Array.from(grouped, ([orderId, items]) => {
        const order = items[0]
        const next = nextDelivery[order.status]
        return (
          <li key={orderId}>
            <h2>Order #{orderId} · {statusLabel(order.status)}</h2>
            <p>Customer #{order.customerId} · {formatDate(order.orderedAt)}</p>
            <p className="review-body">{order.deliveryAddress}</p>
            <ul className="manager-items">
              {items.map((item) => <li key={item.deliveryId}>
                {item.productName} × {item.quantity} · {formatMoney(item.totalPrice, item.currency)}
              </li>)}
            </ul>
            {next && <button disabled={locked}
              onClick={() => update(orderId, `/orders/${orderId}/status`, { status: next.status }, `Order #${orderId}: ${statusLabel(next.status)}.`)}>
              {active === orderId ? 'Updating…' : next.label}
            </button>}
          </li>
        )
      })}
    </ul>
  )
}

function CommentList({ rows, active, update, locked }) {
  return (
    <ul className="manager-list">
      {rows.map((comment) => (
        <li key={comment.id}>
          <h2>{comment.productName}</h2>
          <p>{comment.authorName} · {formatDate(comment.submittedAt)}</p>
          <p className="review-body">{comment.body}</p>
          <div className="manager-actions">
            {['approved', 'rejected'].map((status) => (
              <button key={status} disabled={locked}
                onClick={() => update(comment.id, `/manager/comments/${comment.id}`, { status, revision: comment.revision }, `Comment ${status}.`)}>
                {active === comment.id ? 'Updating…' : status === 'approved' ? 'Approve' : 'Reject'}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function ManagerPage({ kind }) {
  const { user } = useSession()
  const deliveries = kind === 'deliveries'
  const endpoint = deliveries ? '/deliveries' : '/manager/comments'
  const load = useCallback(async (signal) => (await apiRequest(endpoint, { signal }))[kind], [endpoint, kind])
  const resource = useAccountResource(`manager:${user.id}:${kind}`, load)
  const [active, setActive] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const lock = useRef(false)

  async function update(id, url, body, success) {
    if (lock.current) return
    lock.current = true
    setActive(id)
    setMessage('')
    setError('')
    try {
      await apiRequest(url, { method: 'PATCH', body })
      setMessage(success)
      resource.reload()
    } catch (err) {
      setError(err.message || 'The change could not be saved.')
      if (err.status === 409 || err.status === 404 || err.uncertain) resource.reload()
    } finally {
      lock.current = false
      setActive(null)
    }
  }

  const List = deliveries ? DeliveryList : CommentList
  return (
    <main className="manager-page">
      <ManagerNav />
      <h1>{deliveries ? 'Deliveries' : 'Pending comments'}</h1>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <button onClick={resource.reload} disabled={active !== null}>Refresh list</button>
      {resource.status === 'loading' && <p role="status">Loading…</p>}
      {resource.status === 'error' && <p role="alert">The list could not be loaded. Refresh to try again.</p>}
      {resource.status === 'ready' && (resource.data.length
        ? <List rows={resource.data} active={active} locked={active !== null} update={update} />
        : <p>{deliveries ? 'No orders to deliver.' : 'No comments awaiting approval.'}</p>)}
    </main>
  )
}
