import type { Category } from './types'

const CURRENCY_FORMATS: Record<string, Intl.NumberFormatOptions> = {
  TWD: { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 },
  USD: { style: 'currency', currency: 'USD', minimumFractionDigits: 2 },
  JPY: { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 },
}

export function formatValue(value: number, currency: string): string {
  const opts = CURRENCY_FORMATS[currency] ?? CURRENCY_FORMATS['TWD']
  return new Intl.NumberFormat('en-US', opts).format(value)
}

const CAT_COLORS: Record<string, string> = {
  liquid:     'var(--cat-liquid)',
  investment: 'var(--cat-investment)',
  fixed:      'var(--cat-fixed)',
  receivable: 'var(--cat-receivable)',
  debt:       'var(--cat-debt)',
}

export function categoryColor(cat: string): string {
  return CAT_COLORS[cat] ?? 'var(--color-muted)'
}
