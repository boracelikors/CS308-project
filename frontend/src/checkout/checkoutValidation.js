// Checkout form rules (SCRUM-38). Pure functions: card details are only ever passed
// through here and kept in component state; nothing is stored or logged.

// orders.delivery_address is VARCHAR(255)
export const ADDRESS_MIN_LENGTH = 10
export const ADDRESS_MAX_LENGTH = 255

export function validateDeliveryAddress(input) {
  const value = String(input ?? '').trim().replace(/\s+/g, ' ')
  if (value.length === 0) return { ok: false, error: 'Enter a delivery address.' }
  if (value.length < ADDRESS_MIN_LENGTH) return { ok: false, error: 'Enter the full delivery address.' }
  if (value.length > ADDRESS_MAX_LENGTH) {
    return { ok: false, error: `The address can be at most ${ADDRESS_MAX_LENGTH} characters.` }
  }
  return { ok: true, value }
}

// Standard card checksum; catches most typos before anything is sent
export function passesLuhn(digits) {
  let sum = 0
  for (let i = 0; i < digits.length; i += 1) {
    let digit = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

// "4242 4242 4242 4242" -> "4242424242424242"; spaces and dashes are allowed while typing
export function cardDigits(input) {
  return String(input ?? '').replace(/[\s-]/g, '')
}

// Returns { ok: true, payment } or { ok: false, fields: { name: message } }
export function validatePayment({ cardholderName, cardNumber, expiry, cvc }, now = new Date()) {
  const fields = {}

  const name = String(cardholderName ?? '').trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 100) fields.cardholderName = 'Enter the name on the card.'

  const number = cardDigits(cardNumber)
  if (!/^\d{13,19}$/.test(number) || !passesLuhn(number)) fields.cardNumber = 'Enter a valid card number.'

  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(expiry ?? '').trim())
  const month = match ? Number(match[1]) : 0
  const year = match ? 2000 + Number(match[2]) : 0
  if (!match || month < 1 || month > 12) {
    fields.expiry = 'Enter the expiry date as MM/YY.'
  } else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
    // A card is valid until the end of its expiry month
    fields.expiry = 'This card has expired.'
  }

  const code = String(cvc ?? '').trim()
  if (!/^\d{3,4}$/.test(code)) fields.cvc = 'Enter the 3 or 4 digit security code.'

  if (Object.keys(fields).length > 0) return { ok: false, fields }
  return {
    ok: true,
    payment: { cardholderName: name, cardNumber: number, expiryMonth: month, expiryYear: year, cvc: code },
  }
}
