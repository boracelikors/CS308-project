// SCRUM-9: place ProductList inside this section once the cards are ready.
// SCRUM-10: supply the list with the response from GET /products.
export default function ProductSection({ children }) {
  return (
    <section className="product-section" id="products" aria-labelledby="products-title">
      <div className="section-heading">
        <p className="eyebrow">The collection</p>
        <h2 id="products-title">Explore Our Audio Equipment.</h2>
        <p>From a quiet listening session to a live performance. Find your sound.</p>
      </div>
      <div className="product-content">
        {children ?? (
          <div className="collection-empty">
            <span className="empty-mark" aria-hidden="true">∿</span>
            <h3>A little quiet, for now.</h3>
            <p>Our collection is coming soon.</p>
          </div>
        )}
      </div>
    </section>
  )
}
