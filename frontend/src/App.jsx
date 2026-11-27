import { BrowserRouter, Link, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { SessionProvider, Protected } from './auth/Session.jsx'
import { AccountForm, Profile } from './auth/Account.jsx'
import ManagerPage from './manager/ManagerPage.jsx'
import ManagerHome from './manager/ManagerHome.jsx'
import Header from './components/Header.jsx'
import ProductSection from './components/ProductSection.jsx'
import ProductCatalog from './components/ProductCatalog.jsx'
import CartProvider from './cart/CartProvider.jsx'
import { useSession } from './auth/context.js'
import ProductDetailPage from './pages/ProductDetailPage.jsx'
import CartPage from './pages/CartPage.jsx'
import MergeNotice from './cart/MergeNotice.jsx'
import CheckoutPage from './checkout/CheckoutPage.jsx'
import OrderHistoryPage from './orders/OrderHistoryPage.jsx'
import OrderDetailPage from './orders/OrderDetailPage.jsx'
import './App.css'

export function Home() {
  return (
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">For the love of sound</p>
          <h1 id="hero-title">Listen closely.<br /><span>Feel everything.</span></h1>
          <p className="hero-description">A home for high-end audio. Explore equipment for your studio, your stage, and your everyday listening.</p>
          <a className="collection-link" href="#products">Explore the collection <span aria-hidden="true">↗</span></a>
        </div>
        <div className="sound-art" aria-hidden="true">
          <div className="sound-ring ring-outer" />
          <div className="sound-ring ring-middle" />
          <div className="sound-ring ring-inner" />
          <div className="sound-core" />
          <span className="sound-caption">Listen. Create. Perform.</span>
        </div>
      </section>
      <ProductSection>
        <ProductCatalog />
      </ProductSection>
    </main>
  )
}

function ProductRoute() {
  const { id } = useParams()
  return <ProductDetailPage key={id} productId={id} />
}

function OrderRoute({ user }) {
  const { id } = useParams()
  return <OrderDetailPage user={user} orderIdParam={id} />
}

function ShoppingApp() {
  const { user, status } = useSession()
  if (status === 'loading') return <p role="status">Checking your session…</p>

  return (
    <CartProvider key={user?.id ?? 'guest'} user={user}>
      <div className="app-shell">
        <a className="skip-link" href="#main">Skip to content</a>
        <Header />
        <MergeNotice />
        <div className="app-main" id="main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<AccountForm key="login" />} />
            <Route path="/register" element={<AccountForm key="register" register />} />
            <Route path="/profile" element={<Protected><Profile /></Protected>} />
            <Route path="/orders" element={<Protected><OrderHistoryPage user={user} /></Protected>} />
            <Route path="/orders/:id" element={<Protected><OrderRoute user={user} /></Protected>} />
            <Route path="/checkout" element={<Protected><CheckoutPage user={user} defaultAddress={user?.homeAddress} /></Protected>} />
            <Route path="/manager" element={<Protected requiredRole="product_manager"><Outlet /></Protected>}>
              <Route index element={<ManagerHome />} />
              <Route path="deliveries" element={<ManagerPage key="deliveries" kind="deliveries" />} />
              <Route path="comments" element={<ManagerPage key="comments" kind="comments" />} />
            </Route>
            <Route path="/cart" element={<CartPage />} />
            <Route path="/products/:id" element={<ProductRoute />} />
            <Route path="*" element={<section className="account-panel"><h1>Page not found</h1><Link to="/">Return home</Link></section>} />
          </Routes>
        </div>
        <footer className="site-footer">
          <div className="site-footer-inner">
            <a className="footer-brand" href="#top">DOBBY Audiophile House</a>
            <nav className="footer-nav" aria-label="Footer navigation">
              <Link to="/">Collection</Link>
              <Link to="/cart">Cart</Link>
              <Link to="/orders">Orders</Link>
            </nav>
            <p className="footer-meta">CS308 · Group 13</p>
          </div>
        </footer>
      </div>
    </CartProvider>
  )
}

export default function App() {
  return <BrowserRouter><SessionProvider><ShoppingApp /></SessionProvider></BrowserRouter>
}
