import Header from './components/Header.jsx'
import ProductSection from './components/ProductSection.jsx'
import ProductCatalog from './components/ProductCatalog.jsx'
import './App.css'

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
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
        <a className="footer-brand" href="#top">DOBBY Audiophile House</a>
        <p>CS308 · Group 13</p>
      </footer>
    </>
  )
}
