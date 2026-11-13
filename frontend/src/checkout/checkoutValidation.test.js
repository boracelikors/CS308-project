// Checkout form validation tests. Run with: npm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cardDigits, passesLuhn, validateDeliveryAddress, validatePayment } from './checkoutValidation.js'

const NOW = new Date(2026, 10, 12) // 12 November 2026
const VALID = { cardholderName: ' Bora  Celikors ', cardNumber: '4242 4242 4242 4242', expiry: '11/26', cvc: '123' }

describe('delivery address', () => {
  it('accepts and tidies a full address', () => {
    assert.deepEqual(validateDeliveryAddress('  Orta Mah.\n Universite Cad. 27  '), {
      ok: true,
      value: 'Orta Mah. Universite Cad. 27',
    })
  })

  it('rejects empty, too short and too long addresses', () => {
    assert.equal(validateDeliveryAddress('   ').ok, false)
    assert.equal(validateDeliveryAddress('Istanbul').ok, false)
    assert.equal(validateDeliveryAddress('a'.repeat(256)).ok, false)
    assert.equal(validateDeliveryAddress('a'.repeat(255)).ok, true)
  })
})

describe('mock card details', () => {
  it('accepts a valid test card and normalizes it', () => {
    assert.deepEqual(validatePayment(VALID, NOW), {
      ok: true,
      payment: { cardholderName: 'Bora Celikors', cardNumber: '4242424242424242', expiryMonth: 11, expiryYear: 2026, cvc: '123' },
    })
  })

  it('checks the card number checksum', () => {
    assert.equal(passesLuhn('4242424242424242'), true)
    assert.equal(passesLuhn('4242424242424241'), false)
    assert.equal(cardDigits('4242-4242 4242'), '424242424242')
    assert.ok(validatePayment({ ...VALID, cardNumber: '4242 4242 4242 4241' }, NOW).fields.cardNumber)
    assert.ok(validatePayment({ ...VALID, cardNumber: '4242' }, NOW).fields.cardNumber)
  })

  it('treats a card as valid until the end of its expiry month', () => {
    assert.equal(validatePayment({ ...VALID, expiry: '11/26' }, NOW).ok, true)
    assert.equal(validatePayment({ ...VALID, expiry: '10/26' }, NOW).fields.expiry, 'This card has expired.')
    assert.equal(validatePayment({ ...VALID, expiry: '13/27' }, NOW).fields.expiry, 'Enter the expiry date as MM/YY.')
    assert.equal(validatePayment({ ...VALID, expiry: '1/27' }, NOW).fields.expiry, 'Enter the expiry date as MM/YY.')
  })

  it('reports every invalid field at once', () => {
    const result = validatePayment({ cardholderName: '', cardNumber: '', expiry: '', cvc: '12' }, NOW)
    assert.deepEqual(Object.keys(result.fields).sort(), ['cardNumber', 'cardholderName', 'cvc', 'expiry'])
  })
})
