// Pure invoice helpers (SCRUM-36). No database, no PDF library: unit-tested directly.
// Money stays in integer minor units (kuruş), the same rule as cart/cartMath.js.
const { toMinorUnits, formatMinorUnits } = require("../cart/cartMath");

// One invoice per order, so the order ID makes the number unique: (42, 2026) -> "INV-2026-000042"
function invoiceNumber(orderId, issuedAt) {
  if (!Number.isInteger(orderId) || orderId < 1) throw new Error(`Invalid order ID: ${orderId}`);
  return `INV-${issuedAt.getFullYear()}-${String(orderId).padStart(6, "0")}`;
}

// unitPrice "1499.90" x 3 -> "4499.70"
function lineTotal(unitPrice, quantity) {
  return formatMinorUnits(toMinorUnits(unitPrice) * quantity);
}

// Sum of all lines, exact: [{ unitPrice, quantity }] -> "4499.70"
function sumLines(items) {
  return formatMinorUnits(items.reduce((sum, it) => sum + toMinorUnits(it.unitPrice) * it.quantity, 0));
}

// "18749.90" -> "18,749.90" for the printed invoice. Built from the string, never a float.
function formatAmount(value) {
  const [whole, fraction] = formatMinorUnits(toMinorUnits(value)).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

// 13 November 2026 -> "13.11.2026" in Istanbul time
function formatDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(date)
    .replaceAll("/", ".");
}

// Error code kept in the database after a failed send. Only a short code such as
// "ECONNREFUSED" or "EAUTH": the message could contain addresses or server replies.
function mailErrorCode(err) {
  const code = typeof err?.code === "string" ? err.code.toUpperCase() : "";
  return /^[A-Z0-9_]{1,64}$/.test(code) ? code : "SEND_FAILED";
}

module.exports = { invoiceNumber, lineTotal, sumLines, formatAmount, formatDate, mailErrorCode };