import type { AccountType } from './types'

export interface AccTypeItem { type: AccountType; icon: string }
export interface AccGroup { groupKey: 'liquid' | 'investment' | 'other'; colorClass: string; items: AccTypeItem[] }

export const ACC_GROUPS: AccGroup[] = [
  { groupKey: 'liquid', colorClass: 'bg-green-500', items: [
    { type: 'cash', icon: '💵' },
    { type: 'e_wallet', icon: '📲' },
    { type: 'bank', icon: '🏦' },
  ]},
  { groupKey: 'investment', colorClass: 'bg-indigo-500', items: [
    { type: 'broker', icon: '📈' },
    { type: 'crypto_exchange', icon: '₿' },
  ]},
  { groupKey: 'other', colorClass: 'bg-slate-400', items: [
    { type: 'other', icon: '📁' },
  ]},
]
