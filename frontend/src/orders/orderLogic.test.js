// Order history rule tests. Run with: npm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError } from '../api/request.js'
import { classifyLoadError, deliverySteps, parseOrderId, statusLabel } from './orderLogic.js'

describe('order status', () => {
  it('labels the three delivery statuses and tolerates unknown ones', () => {
    assert.equal(statusLabel('processing'), 'Processing')
    assert.equal(statusLabel('in_transit'), 'In transit')
    assert.equal(statusLabel('delivered'), 'Delivered')
    assert.equal(statusLabel('cancelled'), 'Status unavailable')
  })

  it('marks delivery steps up to the current status', () => {
    const order = { status: 'in_transit', createdAt: '2026-11-10T10:00:00Z', inTransitAt: '2026-11-11T09:00:00Z', deliveredAt: null }
    assert.deepEqual(
      deliverySteps(order).map(({ status, done, current }) => [status, done, current]),
      [['processing', true, false], ['in_transit', true, true], ['delivered', false, false]],
    )
    assert.equal(deliverySteps({ ...order, status: 'delivered' })[2].current, true)
  })
})

describe('loading errors', () => {
  it('shows missing and other customers\' orders the same way', () => {
    assert.equal(classifyLoadError(new ApiError('ORDER_NOT_FOUND', 'x', { status: 404 })), 'notFound')
    assert.equal(classifyLoadError(new ApiError('UNAUTHENTICATED', 'x', { status: 401 })), 'signedOut')
    assert.equal(classifyLoadError(new ApiError('FORBIDDEN', 'x', { status: 403 })), 'signedOut')
    assert.equal(classifyLoadError(new ApiError('NETWORK_ERROR', 'x')), 'error')
  })

  it('accepts only plain positive order IDs from a URL', () => {
    assert.equal(parseOrderId('12'), 12)
    for (const bad of ['0', '-1', '1.5', '12abc', '', undefined, '01']) assert.equal(parseOrderId(bad), null, bad)
  })
})
