export { ApiError } from './api/request.js'
export { apiRequest as api } from './api/request.js'
export function safeReturnTo(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\s]/.test(value)) return '/profile'
  try { const url = new URL(value, 'https://local.test'); return url.origin === 'https://local.test' && !/^\/(login|register)(\/|$)/.test(url.pathname) ? url.pathname + url.search + url.hash : '/profile' } catch { return '/profile' }
}
