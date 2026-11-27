import { useCart } from '../cart/cartContext.js'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useSession } from '../auth/context.js'

export default function Header() {
  const { itemCount } = useCart()
  const { status, user, logout, refresh } = useSession()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function signOut() {
    setBusy(true)
    setError('')
    try {
      await logout()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <header className="site-header" id="top">
      <Link className="brand" to="/" aria-label="DOBBY Audiophile House home">
        <span className="brand-icon" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <span>
          DOBBY
          <span className="brand-subtitle">Audiophile House</span>
        </span>
      </Link>

      <nav className="site-nav" aria-label="Main navigation">
        <Link to="/">Collection</Link>
        <Link className="cart-badge" to="/cart">
          Cart <span className="cart-count">{itemCount}</span>
        </Link>
        {status === 'authenticated' ? (
          <>
            {user.role === 'product_manager' && <Link to="/manager">Product manager</Link>}
            <Link to="/orders">Orders</Link>
            <Link to="/profile">{user.name}</Link>
            <button type="button" className="nav-action-btn" onClick={signOut} disabled={busy}>
              Sign out
            </button>
          </>
        ) : status === 'loading' ? (
          <span role="status">Checking session…</span>
        ) : status === 'error' ? (
          <button type="button" className="nav-action-btn" onClick={refresh}>
            Retry connection
          </button>
        ) : (
          <>
            <Link to="/login">Sign in</Link>
            <Link to="/register">Register</Link>
          </>
        )}
        {error && <p className="nav-error" role="alert">{error}</p>}
      </nav>
    </header>
  )
}
