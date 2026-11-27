import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiRequest } from '../api/request.js'
import { useAccountResource } from '../orders/useAccountResource.js'

// Remount for each account/order so no invoice or in-flight result crosses accounts.
export default function InvoicePanel({ userId, orderId }) {
  return <InvoiceContent key={`${userId}:${orderId}`} orderId={orderId} userId={userId} />
}

function InvoiceContent({ userId, orderId }) {
  const load = useCallback(async (signal) => {
    const data = await apiRequest(`/orders/${orderId}/invoice`, { signal })
    if (typeof data?.invoice?.number !== 'string' || !data.invoice.number.trim()) {
      throw new ApiError('BAD_RESPONSE', 'The store did not return an invoice.', { status: 500 })
    }
    return data.invoice
  }, [orderId])
  const invoice = useAccountResource(`${userId}:invoice:${orderId}`, load)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const locked = useRef(false)
  const pending = useRef(null)
  useEffect(() => () => pending.current?.abort(), [])

  async function action(download) {
    if (locked.current) return
    locked.current = true
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setError('')
    try {
      if (download) {
        const blob = await apiRequest(`/orders/${orderId}/invoice/pdf`, { responseType: 'pdf', signal: controller.signal })
        if (controller.signal.aborted) return
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `invoice-${orderId}.pdf`
        document.body.append(link)
        link.click()
        link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else {
        await apiRequest(`/orders/${orderId}/invoice/email`, { method: 'POST', signal: controller.signal })
        if (!controller.signal.aborted) invoice.reload()
      }
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err.message || 'The invoice request failed. Please try again.')
    } finally {
      locked.current = false
      setBusy(false)
    }
  }

  if (invoice.status === 'loading') return <p role="status">Loading invoice…</p>
  if (invoice.status === 'notFound') return <section className="invoice-panel"><h2>Invoice</h2><p>No invoice is available for this order.</p></section>
  if (invoice.status !== 'ready') return <section className="invoice-panel"><h2>Invoice</h2><p role="alert">Your invoice could not be loaded.</p><button onClick={invoice.reload}>Retry invoice</button></section>
  const { number, email } = invoice.data
  const status = email?.status
  const message = status === 'sent' ? 'Invoice email sent.'
    : status === 'sending' ? 'Invoice email is being sent. Refresh its status shortly.'
      : status === 'failed' ? 'Invoice email could not be sent. Your order is confirmed and the PDF is available.'
        : 'Invoice email has not been sent yet. Your PDF is available.'
  return <section className="invoice-panel" aria-label="Invoice">
    <h2>Invoice {number}</h2>
    <p role="status">{message}</p>
    {error && <p role="alert">{error}</p>}
    <div className="invoice-actions">
      <button disabled={busy} onClick={() => action(true)}>Download invoice PDF</button>
      {(status === 'failed' || status === 'pending') && <button disabled={busy} onClick={() => action(false)}>{status === 'failed' ? 'Retry invoice email' : 'Send invoice email'}</button>}
      <button disabled={busy} onClick={invoice.reload}>Refresh email status</button>
    </div>
  </section>
}
