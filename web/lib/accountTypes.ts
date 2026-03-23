import type { AccountType } from './types'

export interface AccTypeItem { type: AccountType; label: string; icon: string }
export interface AccGroup { label: string; colorClass: string; items: AccTypeItem[] }

export const ACC_GROUPS: AccGroup[] = [
  { label: '流動資金', colorClass: 'bg-green-500', items: [
    { type: 'cash', label: '現金', icon: '💵' },
    { type: 'e_wallet', label: '電子錢包', icon: '📲' },
    { type: 'bank', label: '銀行帳戶', icon: '🏦' },
  ]},
  { label: '投資', colorClass: 'bg-indigo-500', items: [
    { type: 'broker', label: '券商', icon: '📈' },
    { type: 'crypto_exchange', label: '加密貨幣交易所', icon: '₿' },
  ]},
  { label: '其他', colorClass: 'bg-slate-400', items: [
    { type: 'other', label: '其他', icon: '📁' },
  ]},
]

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: '銀行', broker: '券商', crypto_exchange: '加密貨幣交易所',
  e_wallet: '電子錢包', cash: '現金', other: '其他',
}
