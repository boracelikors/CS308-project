export class ApiError extends Error {
  constructor(status, error = {}) { super(error.message || 'The service is unavailable. Please try again.'); this.status = status; this.fields = error.fields || {}; this.code = error.code; this.available = error.available }
}
export async function api(path, { body, ...options } = {}) {
  let response
  try { response = await fetch(`${import.meta.env?.VITE_API_BASE_URL || 'http://localhost:3001'}${path}`, {
    ...options, credentials: 'include', headers: { ...(body !== undefined ? {'Content-Type': 'application/json'} : {}), ...options.headers },
    ...(body !== undefined ? {body: JSON.stringify(body)} : {}),
  }) } catch (error) { if (error.name === 'AbortError') throw error; throw new ApiError(0) }
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('auth:expired'))
    throw new ApiError(response.status, data?.error)
  }
  return data
}
export function safeReturnTo(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\s]/.test(value)) return '/profile'
  try { const url = new URL(value, 'https://local.test'); return url.origin === 'https://local.test' && !/^\/(login|register)(\/|$)/.test(url.pathname) ? url.pathname + url.search + url.hash : '/profile' } catch { return '/profile' }
}
