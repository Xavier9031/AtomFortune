export type Currency =
  | 'TWD' | 'USD' | 'JPY' | 'EUR' | 'GBP' | 'CNY' | 'HKD'
  | 'SGD' | 'AUD' | 'CAD' | 'CHF' | 'KRW' | 'MYR' | 'THB'
  | 'VND' | 'IDR' | 'PHP'
export type Category = 'liquid' | 'investment' | 'fixed' | 'receivable' | 'debt'

export interface DashboardSummary {
  snapshotDate: string
  displayCurrency: Currency
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  changeAmount: number | null
  changePct: number | null
  prevSnapshotDate: string | null
  missingAssets: string[]
}

export interface AllocationItem { assetId: string; name: string; value: number; pct: number }
export interface AllocationCategory {
  category: Category; label: string; value: number; pct: number; color: string
  items: AllocationItem[]
}
export interface AllocationData { snapshotDate: string; displayCurrency: Currency; categories: AllocationCategory[] }

export interface NetWorthPoint { date: string; netWorth: number }
export interface NetWorthHistory { displayCurrency: Currency; data: NetWorthPoint[] }

export interface LiveDashboard {
  displayCurrency: Currency
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  changeAmount: number | null
  changePct: number | null
  prevSnapshotDate: string | null
  categories: AllocationCategory[]
}

export type AssetClass = 'asset' | 'liability'
export type SubKind = 'bank_account' | 'stock' | 'etf' | 'crypto' | 'fund' |
  'real_estate' | 'credit_card' | 'mortgage' | 'personal_loan' | 'physical_cash' |
  'e_wallet' | 'stablecoin' | 'precious_metal' | 'vehicle' | 'receivable' | 'other' | string
export type PricingMode = 'market' | 'fixed' | 'manual'
export type AccountType = 'bank' | 'broker' | 'crypto_exchange' | 'e_wallet' | 'cash' | 'other'
export type TxnType = 'buy' | 'sell' | 'transfer_in' | 'transfer_out' | 'adjustment'

export interface Asset {
  id: string; name: string; assetClass: AssetClass; category: Category
  subKind: SubKind; symbol?: string; market?: string
  currencyCode: string; pricingMode: PricingMode; unit?: string
}
export interface Account {
  id: string; name: string; institution?: string
  accountType: AccountType; note?: string
  balance?: string | null
}
export interface Holding {
  assetId: string; accountId: string; quantity: number
  assetName: string; assetClass: AssetClass; category: Category
  subKind: SubKind; symbol?: string | null; currencyCode: string; pricingMode: PricingMode; unit?: string | null
  accountName: string; accountType: AccountType; institution?: string | null
  latestValueInBase: number | null; updatedAt: string
}
export interface Ticker {
  symbol: string
  name: string
  type: 'stock' | 'etf' | 'crypto'
  exchange: string | null
  country: string | null
}

export interface Transaction {
  id: string; assetId: string; accountId: string
  txnType: TxnType; quantity: number; txnDate: string; note?: string
}
export interface SnapshotItem {
  assetId: string; accountId: string; assetName: string; accountName: string
  quantity: number; price: number; currencyCode: string; unit: string | null
  fxRate: number; valueInBase: number
}
