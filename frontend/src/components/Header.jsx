import { useCart } from '../cart/cartContext.js'

export default function Header() {
  const { itemCount } = useCart()

  return (
    <header className="site-header" id="top">
      <a className="brand" href="#top" aria-label="DOBBY Audiophile House home">
        <span className="brand-icon" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        <span>DOBBY<span className="brand-subtitle">Audiophile House</span></span>
      </a>
      <nav aria-label="Main navigation">
        <a href="#products">Our collection <span aria-hidden="true">↗</span></a>
        <span className="cart-badge">
          Cart <span className="cart-count">{itemCount}</span>
          <span className="sr-only">{itemCount === 1 ? ' item' : ' items'}</span>
        </span>
      </nav>
    </header>
  )
}
