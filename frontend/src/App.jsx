import Header from './components/Header.jsx'
import ProductSection from './components/ProductSection.jsx'
import ProductCatalog from './components/ProductCatalog.jsx'
import CartProvider from './cart/CartProvider.jsx'
import { useSession } from './auth/context.js'
import ProductDetailPage from './pages/ProductDetailPage.jsx'
import CartPage from './pages/CartPage.jsx'
import MergeNotice from './cart/MergeNotice.jsx'
import CheckoutPage from './checkout/CheckoutPage.jsx'
import './App.css'

export function Home() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>

      <main id="main">
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
      <footer className="site-footer">
        <a className="footer-brand" href="#top">DOBBY Audophile House</a>
        <p>CS308 · Group 13</p>
      </footer>
    </>
  )
}

import { BrowserRouter, Link, Route, Routes, useParams } from 'react-router-dom'
import { SessionProvider, Protected } from './auth/Session.jsx'
import { AccountForm, Profile } from './auth/Account.jsx'
function PendingPage({title}) { return <section className="account-panel"><h1>{title}</h1><p>This feature is being prepared. Please check back soon.</p><Link to="/">Return to the collection</Link></section> }
function ProductRoute() { const {id} = useParams(); return <ProductDetailPage key={id} productId={id}/> }
function ShoppingApp() { const {user, status} = useSession(); if (status === 'loading') return <p role="status">Checking your session…</p>; return <CartProvider key={user?.id ?? 'guest'} user={user}><Header/><MergeNotice/><Routes>
<Route path="/" element={<Home/>}/><Route path="/login" element={<AccountForm key="login"/>}/><Route path="/register" element={<AccountForm key="register" register/>}/>
<Route path="/profile" element={<Protected><Profile/></Protected>}/>
{['/orders','/orders/:id'].map(path=><Route key={path} path={path} element={<Protected><PendingPage title={path==='/checkout'?'Checkout':'Your orders'}/></Protected>}/>)}
<Route path="/checkout" element={<Protected><CheckoutPage user={user} defaultAddress={user?.homeAddress}/></Protected>}/>
<Route path="/cart" element={<CartPage/>}/><Route path="/products/:id" element={<ProductRoute/>}/>
<Route path="*" element={<section className="account-panel"><h1>Page not found</h1><Link to="/">Return home</Link></section>}/>
</Routes></CartProvider> }
export default function App() { return <BrowserRouter><SessionProvider><ShoppingApp/></SessionProvider></BrowserRouter> }
