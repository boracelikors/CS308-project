import Header from './components/Header.jsx'
import ProductSection from './components/ProductSection.jsx'
import ProductCatalog from './components/ProductCatalog.jsx'
import CartProvider from './cart/CartProvider.jsx'
import ProductDetailPage from './pages/ProductDetailPage.jsx'
import CartPage from './pages/CartPage.jsx'
import { handleLinkClick, useRouter } from './router/router.js'
import './App.css'

export default function App() {
  const { route } = useRouter()

  // No login screen yet: everyone shops as a guest. Pass the GET /auth/me user here once it exists.
  return (
    <CartProvider user={null}>
      <div onClick={handleLinkClick}>
        <a className="skip-link" href="#main">Skip to content</a>
        <Header />
        <main id="main">
          {route.name === 'product-detail' ? (
            <ProductDetailPage productId={route.params.id} />
          ) : route.name === 'cart' ? (
            <CartPage />
          ) : route.name === 'not-found' ? (
            <div className="product-detail-page">
              <div className="product-not-found" role="alert">
                <h2>Page Not Found</h2>
                <p>The page you are looking for does not exist.</p>
                <a href="/" className="collection-link">Return to homepage</a>
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
        </main>
        <footer className="site-footer">
          <a className="footer-brand" href="/">DOBBY Audiophile House</a>
          <p>CS308 · Group 13</p>
        </footer>
      </div>
    </CartProvider>
  )
}
