import { useRef, useState } from 'react'
import { apiRequest } from '../api/request.js'
import { fetchProducts } from '../cart/cartAdapters.js'
import { useSession } from '../auth/context.js'
import { useAccountResource } from '../orders/useAccountResource.js'
import ManagerNav from './ManagerNav.jsx'

const loadProducts = (signal) => fetchProducts({ signal })

function StockForm({ product, onSaved, onConflict }) {
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const current = product.quantityInStock

  async function save(event) {
    event.preventDefault()
    if (!draft || pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const { quantityInStock } = await apiRequest(`/manager/products/${product.id}/stock`, {
        method: 'PATCH', body: { quantity: Number(draft.value), expectedQuantity: draft.expected },
      })
      setDraft(null)
      onSaved(`${product.name}: stock is now ${quantityInStock}.`)
    } catch (err) {
      setError(err.message || 'Stock could not be updated.')
      if (err.status === 409) {
        setDraft(null)
        onConflict()
      }
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return (
    <form className="review-editor" onSubmit={save}>
      <p>Current quantity: {current}</p>
      <label htmlFor="stock-quantity">New stock quantity</label>
      <input id="stock-quantity" type="number" min="0" max="2147483647" step="1" required
        value={draft?.value ?? current} disabled={busy}
        onChange={(event) => setDraft({ value: event.target.value, expected: draft?.expected ?? current })} />
      {' '}
      <button disabled={busy || !draft}>{busy ? 'Saving…' : 'Save stock'}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

export default function ManagerInventory() {
  const { user } = useSession()
  const resource = useAccountResource(`manager:${user.id}:stock`, loadProducts)
  const [selection, setSelection] = useState('')
  const [message, setMessage] = useState('')
  const [conflict, setConflict] = useState(false)
  const items = resource.data ?? []
  const product = items.find((item) => String(item.id) === selection) ?? items[0]

  return (
    <main className="manager-page">
      <ManagerNav />
      <h1>Stock</h1>
      {message && <p role="status">{message}</p>}
      {conflict && <p role="alert">Stock changed. Review the latest quantity before saving again.</p>}
      {resource.status === 'loading' && <p role="status">Loading products…</p>}
      {resource.status === 'error' && <p role="alert">Products could not be loaded. <button onClick={resource.reload}>Retry</button></p>}
      {resource.status === 'ready' && (product ? <>
        <label htmlFor="stock-product">Product</label>{' '}
        <select id="stock-product" value={product.id}
          onChange={(event) => { setSelection(event.target.value); setMessage(''); setConflict(false) }}>
          {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <StockForm key={product.id} product={product} onConflict={() => {
          setMessage(''); setConflict(true); resource.reload()
        }} onSaved={(text) => {
          setConflict(false); setMessage(text); resource.reload()
        }} />
      </> : <p>No active products.</p>)}
    </main>
  )
}
