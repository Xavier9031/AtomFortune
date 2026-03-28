type AssetClass = 'asset' | 'liability'
type Category = 'liquid' | 'investment' | 'fixed' | 'receivable' | 'debt'
type PricingMode = 'market' | 'fixed' | 'manual'

export const CATEGORY_BY_CLASS: Record<AssetClass, Category[]> = {
  asset: ['liquid', 'investment', 'fixed', 'receivable'],
  liability: ['debt'],
}

export const LIQUID_SUBKIND_VALUES = ['bank_account', 'physical_cash', 'e_wallet'] as const

const LIQUID_SUBKINDS = new Set<string>(LIQUID_SUBKIND_VALUES)
const SHARE_BASED_SUBKINDS = new Set(['stock', 'etf'])

export const DEFAULT_PRICING_MODE_BY_SUBKIND: Record<string, PricingMode> = {
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

export function isCategoryAllowed(assetClass: AssetClass, category: string): boolean {
  return CATEGORY_BY_CLASS[assetClass].includes(category as Category)
}

export function isLiquidSubKind(subKind?: string | null): boolean {
  return !!subKind && LIQUID_SUBKINDS.has(subKind)
}

export function getDefaultPricingMode(subKind?: string | null): PricingMode {
  return subKind ? (DEFAULT_PRICING_MODE_BY_SUBKIND[subKind] ?? 'manual') : 'manual'
}

export function normalizeAssetUnit(input: {
  subKind: string
  currencyCode: string
  symbol?: string | null
  unit?: string | null
}): string | null {
  if (isLiquidSubKind(input.subKind)) return input.currencyCode
  if (SHARE_BASED_SUBKINDS.has(input.subKind)) return 'shares'
  if (input.subKind === 'crypto') return input.symbol?.toUpperCase() ?? input.unit ?? null
  if (input.subKind === 'precious_metal') return input.unit ?? 'gram'
  return input.unit ?? null
}
