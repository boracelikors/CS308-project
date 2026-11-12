// Display helpers shared by checkout and order pages

// "1499.90", "TRY" -> "1.499,90 TRY". Amounts arrive as exact DECIMAL strings from the API;
// they are only converted to a number here, for display.
export function formatMoney(amount, currency = 'TRY') {
  if (amount === null || amount === undefined || amount === '') return ''
  const number = Number(amount)
  if (Number.isNaN(number)) return String(amount)
  const text = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number)
  return currency ? `${text} ${currency}` : text
}

// ISO date-time -> "12 Kasım 2026" style date in the store's locale
export function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}
