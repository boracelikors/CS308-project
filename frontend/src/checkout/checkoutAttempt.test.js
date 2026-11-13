// Checkout attempt tests: one order per attempt, safe retries. Run with: npm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError } from '../api/request.js'
import { classifyCheckoutError, createCheckoutAttempt } from './checkoutAttempt.js'

const BODY = { deliveryAddress: 'Orta Mah. Universite Cad. 27', payment: { cardNumber: '4242424242424242' } }
const ORDER = { id: 101, status: 'processing' }

function keys() {
  let n = 0
  return () => `key-${++n}`
}

// Scripted fake POST /checkout: each call takes the next outcome
function fakeCheckout(...outcomes) {
  const calls = []
  return {
    calls,
    async submit(requestKey, body) {
      calls.push({ requestKey, body })
      const outcome = outcomes.shift() ?? { order: ORDER }
      if (outcome instanceof Error) throw outcome
      return outcome
    },
  }
}

const offline = () => new ApiError('NETWORK_ERROR', 'offline')
const declined = () => new ApiError('PAYMENT_DECLINED', 'Declined', { status: 402 })

describe('classifyCheckoutError', () => {
  it('maps backend errors to checkout screens', () => {
    assert.equal(classifyCheckoutError(offline()), 'uncertain')
    assert.equal(classifyCheckoutError(new ApiError('REQUEST_FAILED', 'x', { status: 503 })), 'uncertain')
    // Codes from the SCRUM-34 backend (PR #22)
    assert.equal(classifyCheckoutError(new ApiError('CHECKOUT_IN_PROGRESS', 'x', { status: 503 })), 'uncertain')
    assert.equal(classifyCheckoutError(new ApiError('OUT_OF_STOCK', 'x', { status: 409 })), 'cartChanged')
    assert.equal(classifyCheckoutError(new ApiError('REQUEST_KEY_REUSED', 'x', { status: 422 })), 'invalid')
    assert.equal(classifyCheckoutError(new Error('bug')), 'uncertain')
    assert.equal(classifyCheckoutError(declined()), 'declined')
    assert.equal(classifyCheckoutError(new ApiError('CART_CHANGED', 'x', { status: 409 })), 'cartChanged')
    assert.equal(classifyCheckoutError(new ApiError('UNAUTHENTICATED', 'x', { status: 401 })), 'signedOut')
    assert.equal(classifyCheckoutError(new ApiError('VALIDATION_ERROR', 'x', { status: 400 })), 'invalid')
  })
})

describe('checkout attempt', () => {
  it('sends one request for a double click and reports success only after the server confirms', async () => {
    const server = fakeCheckout()
    const checkout = createCheckoutAttempt({ submitRequest: server.submit, newRequestKey: keys() })
    const first = checkout.submit(BODY)
    checkout.submit(BODY)
    assert.equal(checkout.getState().phase, 'submitting')
    await first
    assert.equal(server.calls.length, 1)
    assert.equal(checkout.getState().phase, 'succeeded')
    assert.equal(checkout.getState().order, ORDER)

    await checkout.submit(BODY) // nothing after success
    assert.equal(server.calls.length, 1)
  })

  it('retries an uncertain response with the same key and body, and blocks a new attempt', async () => {
    const server = fakeCheckout(offline())
    const checkout = createCheckoutAttempt({ submitRequest: server.submit, newRequestKey: keys() })
    await checkout.submit(BODY)
    assert.equal(checkout.getState().phase, 'uncertain')

    await checkout.submit({ ...BODY, deliveryAddress: 'Another street 12345' })
    checkout.edit()
    assert.equal(server.calls.length, 1, 'no new attempt while the first may have succeeded')

    await checkout.retry()
    assert.deepEqual(server.calls.map((c) => c.requestKey), ['key-1', 'key-1'])
    assert.equal(server.calls[1].body, BODY)
    assert.equal(checkout.getState().phase, 'succeeded')
  })

  it('starts a new attempt with a new key after a decline', async () => {
    const server = fakeCheckout(declined())
    const checkout = createCheckoutAttempt({ submitRequest: server.submit, newRequestKey: keys() })
    await checkout.submit(BODY)
    assert.equal(checkout.getState().phase, 'declined')
    await checkout.retry() // retry is only for uncertain outcomes
    assert.equal(server.calls.length, 1)

    checkout.edit()
    assert.equal(checkout.getState().phase, 'editing')
    await checkout.submit(BODY)
    assert.deepEqual(server.calls.map((c) => c.requestKey), ['key-1', 'key-2'])
  })

  it('reports a changed cart so the customer can review it', async () => {
    const server = fakeCheckout(new ApiError('CART_CHANGED', 'Prices changed', { status: 409 }))
    const checkout = createCheckoutAttempt({ submitRequest: server.submit, newRequestKey: keys() })
    await checkout.submit(BODY)
    assert.equal(checkout.getState().phase, 'cartChanged')
  })

  it('notifies subscribers on every change', async () => {
    const checkout = createCheckoutAttempt({ submitRequest: fakeCheckout().submit, newRequestKey: keys() })
    const phases = []
    const unsubscribe = checkout.subscribe(() => phases.push(checkout.getState().phase))
    await checkout.submit(BODY)
    unsubscribe()
    assert.deepEqual(phases, ['submitting', 'succeeded'])
  })
})

it('persists only the key before sending and keeps it for an uncertain result', async () => {
  const events = [];
  const checkout = createCheckoutAttempt({
    newRequestKey: () => 'durable-key',
    remember: key => events.push(['remember', key]),
    forget: () => events.push(['forget']),
    submitRequest: async () => { events.push(['send']); throw new ApiError('NETWORK_ERROR', 'offline') },
  });
  await checkout.submit(BODY);
  assert.deepEqual(events, [['remember', 'durable-key'], ['send']]);
  assert.equal(checkout.getState().phase, 'uncertain');
});
it('refuses to send when recovery storage is unavailable', async () => {
  let sent = false;
  const checkout = createCheckoutAttempt({remember: () => { throw new Error('quota') }, submitRequest: async () => {sent = true}});
  await checkout.submit(BODY);
  assert.equal(sent, false);
  assert.equal(checkout.getState().phase, 'invalid');
});
