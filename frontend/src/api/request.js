// Shared fetch wrapper for the backend API.
// Sends the login cookie and turns the backend error shape { error: { code, message, ... } }
// into an ApiError, so every page handles failures the same way.

export const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:3001'

export class ApiError extends Error {
  constructor(code, message, { status = null, details = {} } = {}) {
    super(message)
    this.code = code
    this.status = status
    Object.assign(this, details)
  }

  // True when we cannot know whether the server applied the request
  // (no response, or a server error). Such requests are retried with the same request key.
  get uncertain() {
    return this.status === null || this.status >= 500
  }
}

export async function apiRequest(path, { method = 'GET', body, signal, fetch: fetchImpl = globalThis.fetch, withResponse = false } = {}) {
  let response
  try {
    response = await fetchImpl(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new ApiError('NETWORK_ERROR', 'The store could not be reached. Please try again.')
  }

  if (response.status === 204) return null
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/') && typeof window !== 'undefined') window.dispatchEvent(new Event('auth:expired'))
    const { code, message, ...details } = data?.error ?? {}
    throw new ApiError(code ?? 'REQUEST_FAILED', message ?? 'Something went wrong. Please try again.', {
      status: response.status,
      details,
    })
  }
  if (data === null) {
    // A success status without a readable body: treat the outcome as unknown
    throw new ApiError('BAD_RESPONSE', 'The store sent an unexpected response. Please try again.', {
      status: 500,
    })
  }
  return withResponse ? {data, headers:response.headers} : data
}
