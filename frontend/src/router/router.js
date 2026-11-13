// Pure product-path parser retained for rule tests. App uses React Router.
/**
 * Parses pathname into a structured route object.
 * Supported routes:
 *   - '/' or '' -> { name: 'home' }
 *   - '/products/:id' -> { name: 'product-detail', params: { id: Number } }
 *   - '/cart' -> { name: 'cart' }
 *   - other -> { name: 'not-found' }
 */
export function matchRoute(pathname = '/') {
  // Normalize path (strip trailing slash unless root)
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

  if (path === '' || path === '/' || path === '/index.html') {
    return { name: 'home', params: {} }
  }

  if (path === '/cart') {
    return { name: 'cart', params: {} }
  }

  const productMatch = /^\/products\/([1-9]\d*)$/.exec(path)
  if (productMatch) {
    const id = Number(productMatch[1])
    return { name: 'product-detail', params: { id } }
  }

  return { name: 'not-found', params: {} }
}

