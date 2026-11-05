import { useEffect, useState } from 'react'
import ProductList from './ProductList.jsx'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

export default function ProductCatalog() {
  const [products, setProducts] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const controller = new AbortController()

    async function loadProducts() {
      try {
        const response = await fetch(`${API_BASE_URL}/products`, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`GET /products responded with ${response.status}`)
        }

        setProducts(await response.json())
        setStatus('ready')
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error(error)
          setStatus('error')
        }
      }
    }

    loadProducts()
    return () => controller.abort()
  }, [])

  if (status === 'loading') {
    return <p className="product-status" role="status">Loading products...</p>
  }

  if (status === 'error') {
    return <p className="product-status product-status--error" role="alert">Products could not be loaded</p>
  }

  return <ProductList products={products} />
}
