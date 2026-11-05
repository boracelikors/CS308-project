import ProductCard from './ProductCard.jsx'

/**
 * Reusable Product List Component (SCRUM-9)
 *
 * Props:
 *  - products: Array of product objects
 */
export default function ProductList({ products = [] }) {
  if (!products || products.length === 0) {
    return (
      <div className="product-list-empty">
        <p>No products available to display.</p>
      </div>
    )
  }

  return (
    <div className="product-grid" role="region" aria-label="Audio Products Collection">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
