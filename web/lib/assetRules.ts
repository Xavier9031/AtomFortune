import type { AssetClass, Category, PricingMode, SubKind } from './types'

export const CATEGORY_BY_CLASS: Record<AssetClass, Category[]> = {
  asset: ['liquid', 'investment', 'fixed', 'receivable'],
  liability: ['debt'],
}

export const SUB_KIND_BY_CATEGORY: Record<Category, SubKind[]> = {
  liquid: ['bank_account', 'physical_cash', 'e_wallet', 'other'],
  investment: ['stock', 'etf', 'crypto', 'fund', 'precious_metal', 'other'],
  fixed: ['real_estate', 'vehicle', 'other'],
  receivable: ['receivable'],
  debt: ['credit_card', 'mortgage', 'personal_loan', 'other'],
}

export const DEFAULT_PRICING_MODE: Record<string, PricingMode> = {
  bank_account: 'fixed',
  physical_cash: 'fixed',
  e_wallet: 'fixed',
  receivable: 'fixed',
  credit_card: 'fixed',
  mortgage: 'fixed',
  personal_loan: 'fixed',
  stock: 'market',
  etf: 'market',
  crypto: 'market',
  fund: 'manual',
  precious_metal: 'market',
  real_estate: 'manual',
  vehicle: 'manual',
  other: 'manual',
}

export const LIQUID_SUBKINDS: SubKind[] = ['bank_account', 'physical_cash', 'e_wallet']

const LIQUID_SUBKIND_SET = new Set<string>(LIQUID_SUBKINDS)
const SHARE_BASED_SUBKINDS = new Set(['stock', 'etf'])

export type UnitSource = {
  subKind?: string | null
  unit?: string | null
  symbol?: string | null
  currencyCode: string
}

export function isLiquidSubKind(subKind?: string | null): boolean {
  return !!subKind && LIQUID_SUBKIND_SET.has(subKind)
}

export function getDefaultPricingMode(subKind?: string | null): PricingMode {
  return subKind ? (DEFAULT_PRICING_MODE[subKind] ?? 'manual') : 'manual'
}

export function isMarketPricedSubKind(subKind?: string | null): boolean {
  return getDefaultPricingMode(subKind) === 'market'
}

export function getDefaultUnitForSubKind(source: {
  subKind?: string | null
  currencyCode: string
  symbol?: string | null
}): string {
  if (isLiquidSubKind(source.subKind)) return source.currencyCode
  if (source.subKind && SHARE_BASED_SUBKINDS.has(source.subKind)) return 'shares'
  if (source.subKind === 'precious_metal') return 'gram'
  if (source.subKind === 'crypto') return source.symbol?.toUpperCase() ?? ''
  return ''
}

export function getDisplayUnit(source: UnitSource): string {
  if (isLiquidSubKind(source.subKind)) return source.currencyCode
  if (source.subKind && SHARE_BASED_SUBKINDS.has(source.subKind)) return 'shares'
  return source.unit ?? source.symbol ?? source.currencyCode
}

export function getHoldingUnit(source: UnitSource): string {
  return getDisplayUnit(source)
}
