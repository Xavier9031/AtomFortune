export type Currency = 'TWD' | 'USD' | 'JPY'
export type Category = 'liquid' | 'investment' | 'fixed' | 'receivable' | 'debt'

export interface DashboardSummary {
  snapshotDate: string
  displayCurrency: Currency
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  changeAmount: number | null
  changePct: number | null
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
