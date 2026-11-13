// Input checks for POST /checkout (SCRUM-34). Pure functions: no database.
const crypto = require("node:crypto");

// requestKey: 8-64 letters, digits, "-" or "_" (the frontend sends crypto.randomUUID())
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Standard card checksum (mod 10)
function luhnValid(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function validateIdempotencyKey(value) {
  return typeof value === "string" && KEY_PATTERN.test(value);
}

// Body agreed with the frontend (SCRUM-38 checkoutApi.js):
//   { requestKey, expectedTotal, deliveryAddress,
//     payment: { cardholderName, cardNumber, expiryMonth, expiryYear, cvc } }
// Returns { ok: true, value } or { ok: false, fields } with the form's field names.
// value.card holds the full number only in memory, for the mock bank call.
// `now` is injectable so expiry checks are testable.
function validateCheckout(body, now = new Date()) {
  const input = body && typeof body === "object" ? body : {};
  const fields = {};

  const key = input.requestKey;
  if (!validateIdempotencyKey(key)) {
    fields.requestKey = "requestKey must be 8-64 letters, digits, - or _ (e.g. a UUID).";
  }

  // Optional: falls back to the customer's home address
  let deliveryAddress = null;
  if (input.deliveryAddress !== undefined && input.deliveryAddress !== null) {
    deliveryAddress = trimmed(input.deliveryAddress);
    if (deliveryAddress.length < 10 || deliveryAddress.length > 255) {
      fields.deliveryAddress = "Delivery address must be 10-255 characters.";
    }
  }

  // The total the customer saw and confirmed, e.g. "37499.80"
  const expectedTotal = trimmed(input.expectedTotal);
  if (!/^\d+\.\d{2}$/.test(expectedTotal)) {
    fields.expectedTotal = "expectedTotal must be the amount shown, e.g. \"1499.90\".";
  }

  const payment = input.payment && typeof input.payment === "object" ? input.payment : {};
  const holderName = trimmed(payment.cardholderName).replace(/\s+/g, " ");
  if (holderName.length < 2 || holderName.length > 100) {
    fields.cardholderName = "Enter the name on the card.";
  }
  const number = typeof payment.cardNumber === "string" ? payment.cardNumber.replace(/[\s-]/g, "") : "";
  if (!/^\d{13,19}$/.test(number) || !luhnValid(number)) {
    fields.cardNumber = "Enter a valid card number.";
  }
  const month = Number(payment.expiryMonth);
  const year = Number(payment.expiryYear);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) {
    fields.expiry = "Enter the expiry date as MM/YY.";
  } else {
    const thisMonth = now.getFullYear() * 12 + now.getMonth(); // getMonth is 0-based
    if (year * 12 + (month - 1) < thisMonth) fields.expiry = "This card has expired.";
  }
  const cvv = typeof payment.cvc === "string" ? payment.cvc.trim() : "";
  if (!/^\d{3,4}$/.test(cvv)) {
    fields.cvc = "Enter the 3 or 4 digit security code.";
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return {
    ok: true,
    value: {
      requestKey: key,
      deliveryAddress,
      expectedTotal,
      card: { holderName, number, expiryMonth: month, expiryYear: year, cvv },
    },
  };
}

// Fingerprint of a request, stored with its requestKey so the same key
// with different input can be rejected. Uses no full card number and no CVV.
function requestHash({ deliveryAddress, expectedTotal, card }) {
  const safe = {
    deliveryAddress,
    expectedTotal,
    cardLast4: card.number.slice(-4),
    expiry: `${card.expiryMonth}/${card.expiryYear}`,
    holderName: card.holderName,
  };
  return crypto.createHash("sha256").update(JSON.stringify(safe)).digest("hex");
}

module.exports = { validateCheckout, validateIdempotencyKey, requestHash, luhnValid };
