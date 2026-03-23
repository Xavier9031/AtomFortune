import type { Category } from './types'

// Currencies where decimals are not meaningful
const ZERO_DECIMAL_CURRENCIES = new Set(['TWD', 'JPY', 'KRW', 'VND', 'IDR'])

export function formatValue(value: number, currency: string): string {
  const maximumFractionDigits = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency,
      minimumFractionDigits: maximumFractionDigits,
      maximumFractionDigits,
    }).format(value)
  } catch {
    // Fallback for unknown/invalid currency codes
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value) + ' ' + currency
  }
}

export const UNIT_I18N_KEYS = new Set(['shares', 'gram', 'ounce', 'unit'])

export function getHoldingUnit(h: { unit?: string | null; symbol?: string | null; currencyCode: string }): string {
  return h.unit ?? h.symbol ?? h.currencyCode
}

export function translateUnit(raw: string, t: (key: string) => string): string {
  if (UNIT_I18N_KEYS.has(raw)) return t(`assets.units.${raw}`)
  return raw
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
