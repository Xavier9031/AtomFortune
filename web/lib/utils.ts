import type { Category } from './types'

// Currencies where decimals are not meaningful
const ZERO_DECIMAL_CURRENCIES = new Set(['TWD', 'JPY', 'KRW', 'VND', 'IDR'])
const LIQUID_SUBKINDS = new Set(['bank_account', 'physical_cash', 'e_wallet'])

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

// Legacy locale-specific values → canonical i18n keys
const LEGACY_UNIT_MAP: Record<string, string> = {
  '股': 'shares',
  '公克': 'gram',
  '盎司': 'ounce',
}

// subKinds that always use 'shares' regardless of stored unit
const SUBKIND_UNIT: Record<string, string> = {
  stock: 'shares',
  etf: 'shares',
}

type UnitSource = {
  subKind?: string | null
  unit?: string | null
  symbol?: string | null
  currencyCode: string
}

export function getDefaultUnitForSubKind(source: {
  subKind?: string | null
  currencyCode: string
  symbol?: string | null
}): string {
  if (source.subKind && LIQUID_SUBKINDS.has(source.subKind)) return source.currencyCode
  if (source.subKind && SUBKIND_UNIT[source.subKind]) return SUBKIND_UNIT[source.subKind]
  if (source.subKind === 'precious_metal') return 'gram'
  if (source.subKind === 'crypto') return source.symbol?.toUpperCase() ?? ''
  return ''
}

export function getDisplayUnit(source: UnitSource): string {
  if (source.subKind && LIQUID_SUBKINDS.has(source.subKind)) return source.currencyCode
  if (source.subKind && SUBKIND_UNIT[source.subKind]) return SUBKIND_UNIT[source.subKind]
  return source.unit ?? source.symbol ?? source.currencyCode
}

export function getHoldingUnit(h: UnitSource): string {
  return getDisplayUnit(h)
}

export function translateUnit(raw: string, t: (key: string) => string): string {
  const canonical = LEGACY_UNIT_MAP[raw] ?? raw
  if (UNIT_I18N_KEYS.has(canonical)) return t(`assets.units.${canonical}`)
  return canonical
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
