const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

export function formatPrice(price: number, currency: string): string {
  if (currency === 'COP') return COP.format(price)
  return `${currency} ${price.toLocaleString()}`
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`
}
