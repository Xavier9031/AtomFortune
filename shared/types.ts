export type AssetClass = 'asset' | 'liability'
export type Category = 'liquid' | 'investment' | 'fixed' | 'receivable' | 'debt'
export type PricingMode = 'market' | 'fixed' | 'manual'
export type AccountType = 'bank' | 'broker' | 'crypto_exchange' | 'e_wallet' | 'cash' | 'other'
export type TxnType = 'buy' | 'sell' | 'transfer_in' | 'transfer_out' | 'adjustment'

export interface Asset {
  id: string
  name: string
  assetClass: AssetClass
  category: Category
  subKind: string
  symbol: string | null
  market: string | null
  currencyCode: string
  pricingMode: PricingMode
  createdAt: string
  updatedAt: string
}

export interface Account {
  id: string
  name: string
  institution: string | null
  accountType: AccountType
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface Holding {
  assetId: string
  accountId: string
  quantity: string
  createdAt: string
  updatedAt: string
}
