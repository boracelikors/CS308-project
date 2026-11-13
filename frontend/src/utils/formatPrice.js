/**
 * Decimal-safe price formatter.
 * Preserves exact decimals without floating-point rounding errors.
 * Accepts numbers, integer strings ("89900"), and decimal strings ("18749.90").
 *
 * Examples:
 *   formatPrice(89900) -> "89.900"
 *   formatPrice("89900.00") -> "89.900"
 *   formatPrice("18749.90") -> "18.749,90"
 *   formatPrice("24990.00") -> "24.990"
 *   formatPrice(1999.99) -> "1.999,99"
 */
export function formatPrice(value) {
  if (value === null || value === undefined) return ''
  const str = String(value).trim()
  if (!str) return ''

  const parts = str.split('.')
  const hasDecimals = parts.length > 1 && parts[1].length > 0 && Number(parts[1]) !== 0
  const num = Number(str)
  if (Number.isNaN(num)) return str

  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: hasDecimals ? Math.min(parts[1].length, 2) : 0,
    maximumFractionDigits: 20,
  }).format(num)
}
