// Cart money and quantity rules (SCRUM-28 items 4-5).
// Money is handled as integer minor units (kurus) so totals are exact:
// 0.1 + 0.2 is not 0.3 in floating point, but 10 + 20 is always 30.

// "1499.90" -> 149990. Accepts at most 2 decimals; rejects negatives and junk.
// Prices should arrive as DECIMAL strings from MySQL, not as JS floats.
function toMinorUnits(value) {
  const text = String(value ?? "").trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) {
    throw new Error(`Invalid money amount: ${value}`);
  }
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const minor = whole * 100 + fraction;
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`Money amount too large: ${value}`);
  }
  return minor;
}

// 149990 -> "1499.90"
function formatMinorUnits(minor) {
  if (!Number.isSafeInteger(minor) || minor < 0) {
    throw new Error(`Invalid minor amount: ${minor}`);
  }
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}

// Checks a requested quantity against current stock.
// Returns { ok: true } or { ok: false, code, message[, available] }.
function validateQuantity(quantity, stock) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, code: "INVALID_QUANTITY", message: "Quantity must be a whole number of at least 1." };
  }
  if (stock <= 0) {
    return { ok: false, code: "OUT_OF_STOCK", message: "This product is out of stock." };
  }
  if (quantity > stock) {
    return { ok: false, code: "INSUFFICIENT_STOCK", message: `Only ${stock} left in stock.`, available: stock };
  }
  return { ok: true };
}

// lines: [{ productId, unitPrice: "1499.90", currency: "TRY", quantity: 2 }]
// Prices always come from the database, never from the client.
function cartTotals(lines) {
  if (lines.length === 0) {
    return { lines: [], subtotal: "0.00", currency: null };
  }
  const currency = lines[0].currency;
  let subtotalMinor = 0;
  const priced = lines.map((line) => {
    if (line.currency !== currency) {
      throw new Error("All cart lines must use the same currency.");
    }
    const unitMinor = toMinorUnits(line.unitPrice);
    const lineMinor = unitMinor * line.quantity;
    if (!Number.isSafeInteger(lineMinor)) {
      throw new Error("Line total too large.");
    }
    subtotalMinor += lineMinor;
    return {
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: formatMinorUnits(unitMinor),
      lineTotal: formatMinorUnits(lineMinor),
    };
  });
  return { lines: priced, subtotal: formatMinorUnits(subtotalMinor), currency };
}

module.exports = { toMinorUnits, formatMinorUnits, validateQuantity, cartTotals };
