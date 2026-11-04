export default function Header() {
  return (
    <header className="site-header" id="top">
      <a className="brand" href="#top" aria-label="DOBBY Audiophile House home">
        <span className="brand-icon" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        <span>DOBBY<span className="brand-subtitle">Audiophile House</span></span>
      </a>
      <nav aria-label="Main navigation">
        <a href="#products">Our collection <span aria-hidden="true">↗</span></a>
      </nav>
    </header>
  )
}
