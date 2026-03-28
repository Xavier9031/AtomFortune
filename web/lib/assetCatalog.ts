import type { AssetClass, Category, SubKind } from './types'

export interface AssetKindItem {
  subKind: SubKind
  labelKey: string
  icon: string
  assetClass: AssetClass
  category: Category
  useTicker?: boolean
}

export interface AssetGroup {
  labelKey: string
  colorClass: string
  items: AssetKindItem[]
}

export const PRECIOUS_METALS = [
  { nameKey: 'assets.preciousMetals.gold' as const, symbol: 'XAUUSD=X' },
  { nameKey: 'assets.preciousMetals.silver' as const, symbol: 'XAGUSD=X' },
  { nameKey: 'assets.preciousMetals.platinum' as const, symbol: 'XPTUSD=X' },
]

export const UNIT_OPTIONS = [
  { value: 'gram', tKey: 'assets.units.gram' as const },
  { value: 'ounce', tKey: 'assets.units.ounce' as const },
]

export const ASSET_GROUPS: AssetGroup[] = [
  { labelKey: 'asset.groups.liquid', colorClass: 'bg-green-500', items: [
    { subKind: 'bank_account', labelKey: 'asset.subKinds.bank_account', icon: '🏦', assetClass: 'asset', category: 'liquid' },
    { subKind: 'physical_cash', labelKey: 'asset.subKinds.physical_cash', icon: '💵', assetClass: 'asset', category: 'liquid' },
    { subKind: 'e_wallet', labelKey: 'asset.subKinds.e_wallet', icon: '📲', assetClass: 'asset', category: 'liquid' },
    { subKind: 'other', labelKey: 'asset.itemLabels.liquid_other', icon: '📦', assetClass: 'asset', category: 'liquid' },
  ]},
  { labelKey: 'asset.groups.investment', colorClass: 'bg-indigo-500', items: [
    { subKind: 'stock', labelKey: 'asset.itemLabels.stock_etf', icon: '📊', assetClass: 'asset', category: 'investment', useTicker: true },
    { subKind: 'crypto', labelKey: 'asset.subKinds.crypto', icon: '₿', assetClass: 'asset', category: 'investment', useTicker: true },
    { subKind: 'fund', labelKey: 'asset.subKinds.fund', icon: '💰', assetClass: 'asset', category: 'investment' },
    { subKind: 'precious_metal', labelKey: 'asset.subKinds.precious_metal', icon: '🥇', assetClass: 'asset', category: 'investment' },
    { subKind: 'other', labelKey: 'asset.itemLabels.investment_other', icon: '📦', assetClass: 'asset', category: 'investment' },
  ]},
  { labelKey: 'asset.groups.fixed', colorClass: 'bg-violet-500', items: [
    { subKind: 'real_estate', labelKey: 'asset.subKinds.real_estate', icon: '🏠', assetClass: 'asset', category: 'fixed' },
    { subKind: 'vehicle', labelKey: 'asset.subKinds.vehicle', icon: '🚗', assetClass: 'asset', category: 'fixed' },
    { subKind: 'other', labelKey: 'asset.itemLabels.fixed_other', icon: '📦', assetClass: 'asset', category: 'fixed' },
  ]},
  { labelKey: 'asset.groups.receivable', colorClass: 'bg-sky-400', items: [
    { subKind: 'receivable', labelKey: 'asset.subKinds.receivable', icon: '📋', assetClass: 'asset', category: 'receivable' },
  ]},
  { labelKey: 'asset.groups.debt', colorClass: 'bg-slate-400', items: [
    { subKind: 'credit_card', labelKey: 'asset.subKinds.credit_card', icon: '💳', assetClass: 'liability', category: 'debt' },
    { subKind: 'mortgage', labelKey: 'asset.subKinds.mortgage', icon: '🏡', assetClass: 'liability', category: 'debt' },
    { subKind: 'personal_loan', labelKey: 'asset.subKinds.personal_loan', icon: '💸', assetClass: 'liability', category: 'debt' },
    { subKind: 'other', labelKey: 'asset.itemLabels.debt_other', icon: '📦', assetClass: 'liability', category: 'debt' },
  ]},
]
