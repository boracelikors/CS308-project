export default function Header() {
  return (
    <header className="site-header" id="top">
      <a className="brand" href="#top" aria-label="Audio Equipment Store home">
        <span className="brand-icon" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        <span>Audio<span className="brand-subtitle">Equipment Store</span></span>
      </a>
      <nav aria-label="Main navigation">
        <a href="#products">Our collection <span aria-hidden="true">↗</span></a>
      </nav>
    </header>
  )
}
