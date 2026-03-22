import type { AssetClass, Category, SubKind, PricingMode } from './types'

export const CATEGORY_BY_CLASS: Record<AssetClass, Category[]> = {
  asset: ['liquid', 'investment', 'fixed', 'receivable'],
  liability: ['debt'],
}
export const SUB_KIND_BY_CATEGORY: Record<Category, SubKind[]> = {
  liquid: ['bank_account', 'physical_cash', 'e_wallet', 'stablecoin', 'other'],
  investment: ['stock', 'etf', 'crypto', 'fund', 'precious_metal', 'other'],
  fixed: ['real_estate', 'vehicle', 'other'],
  receivable: ['receivable'],
  debt: ['credit_card', 'mortgage', 'personal_loan', 'other'],
}
export const DEFAULT_PRICING_MODE: Record<string, PricingMode> = {
  bank_account: 'fixed', physical_cash: 'fixed', stablecoin: 'fixed',
  e_wallet: 'fixed', receivable: 'fixed', credit_card: 'fixed',
  mortgage: 'fixed', personal_loan: 'fixed',
  stock: 'market', etf: 'market', crypto: 'market',
  fund: 'manual', precious_metal: 'manual', real_estate: 'manual',
  vehicle: 'manual', other: 'manual',
}
