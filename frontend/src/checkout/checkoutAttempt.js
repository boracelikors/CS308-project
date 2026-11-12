// One checkout attempt = one request key + one request body (SCRUM-38).
// - A new attempt gets a new key.
// - After an uncertain outcome (no response or a server error) the order may already
//   exist, so only retry() is allowed: same key, same body. The server then returns the
//   first result instead of creating a second order.
// - Clicks while a request is running are ignored.
// Card details live only in this object's memory and are dropped once the outcome is known.

// Proposed SCRUM-34 error codes for outcomes that need a different screen
const CART_CHANGE_CODES = new Set(['CART_CHANGED', 'EMPTY_CART', 'OUT_OF_STOCK', 'INSUFFICIENT_STOCK', 'PRODUCT_NOT_FOUND'])

// 'uncertain' | 'declined' | 'cartChanged' | 'signedOut' | 'invalid'
export function classifyCheckoutError(error) {
  if (error?.uncertain || typeof error?.code !== 'string') return 'uncertain'
  if (error.code === 'PAYMENT_DECLINED') return 'declined'
  if (CART_CHANGE_CODES.has(error.code)) return 'cartChanged'
  if (error.status === 401 || error.status === 403) return 'signedOut'
  return 'invalid'
}

const IDLE = { phase: 'editing', order: null, error: null }

// submitRequest(requestKey, body) -> { order, ... }; throws ApiError on failure
export function createCheckoutAttempt({ submitRequest, newRequestKey = () => crypto.randomUUID() }) {
  let state = IDLE
  let attempt = null // { requestKey, body } kept only while a retry may be needed
  let running = null
  const listeners = new Set()

  function setState(next) {
    state = next
    for (const listener of listeners) listener()
  }

  function send() {
    setState({ ...state, phase: 'submitting', error: null })
    running = submitRequest(attempt.requestKey, attempt.body).then(
      (result) => {
        attempt = null
        setState({ phase: 'succeeded', order: result.order, result, error: null })
      },
      (error) => {
        const phase = classifyCheckoutError(error)
        if (phase !== 'uncertain') attempt = null // the outcome is known; the next attempt is new
        setState({ phase, order: null, error })
      },
    ).finally(() => {
      running = null
    })
    return running
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    // Starts a new attempt. Ignored while one is running, after success, or while
    // an uncertain attempt must be retried first.
    submit(body) {
      if (running) return running
      if (state.phase === 'succeeded' || state.phase === 'uncertain') return Promise.resolve()
      attempt = { requestKey: newRequestKey(), body }
      return send()
    },

    // Resends the uncertain attempt with the same key and body
    retry() {
      if (running) return running
      if (state.phase !== 'uncertain' || !attempt) return Promise.resolve()
      return send()
    },

    // Back to the form after a known failure (decline, cart change, invalid input)
    edit() {
      if (running || state.phase === 'succeeded' || state.phase === 'uncertain') return
      setState(IDLE)
    },
  }
}
