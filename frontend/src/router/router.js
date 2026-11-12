// Lightweight client-side router for Vite SPA navigation (SCRUM-18, SCRUM-30, SCRUM-31).
// Pure path matching and React hook without external dependencies.
import { useEffect, useState } from 'react'

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

const NAVIGATE_EVENT = 'dobby:navigate'

/**
 * Programmatic client-side navigation.
 * Updates browser history and dispatches navigation event.
 */
export function navigate(to, { replace = false } = {}) {
  if (typeof window === 'undefined') return
  if (replace) {
    window.history.replaceState(null, '', to)
  } else {
    window.history.pushState(null, '', to)
  }
  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { to } }))
}

/**
 * Click handler for anchor tags to perform smooth client-side SPA navigation.
 * Leaves external links, Ctrl/Cmd+click, and hash anchors to browser default.
 */
export function handleLinkClick(e) {
  if (
    e.defaultPrevented ||
    e.button !== 0 ||
    e.metaKey ||
    e.altKey ||
    e.ctrlKey ||
    e.shiftKey
  ) {
    return
  }

  const anchor = e.target.closest('a')
  if (!anchor) return

  const href = anchor.getAttribute('href')
  if (!href) return

  const target = anchor.getAttribute('target')
  if (target && target !== '_self') return

  // Hash-only links on same page (#products) are left to browser or scrolled
  if (href.startsWith('#')) return

  // External URLs (http/https/mailto) are left to browser
  if (/^[a-z]+:/i.test(href)) return

  // Internal route link: intercept for client-side navigation
  e.preventDefault()
  navigate(href)
}

/**
 * React hook for current route and location.
 */
export function useRouter() {
  const getPath = () => (typeof window !== 'undefined' ? window.location.pathname : '/')
  const [path, setPath] = useState(getPath)

  useEffect(() => {
    function onLocationChange() {
      setPath(window.location.pathname)
    }

    window.addEventListener('popstate', onLocationChange)
    window.addEventListener(NAVIGATE_EVENT, onLocationChange)

    return () => {
      window.removeEventListener('popstate', onLocationChange)
      window.removeEventListener(NAVIGATE_EVENT, onLocationChange)
    }
  }, [])

  const route = matchRoute(path)

  return {
    path,
    route,
    navigate,
  }
}
