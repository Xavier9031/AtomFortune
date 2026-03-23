'use client'
import type { Account, AccountType } from '@/lib/types'

const TYPE_LABELS: Record<AccountType, string> = {
  bank: '銀行', broker: '券商', crypto_exchange: '加密貨幣交易所',
  e_wallet: '電子錢包', cash: '現金', other: '其他',
}
interface Props {
  accounts: Account[]
  holdingsCount: Record<string, number>
  onEdit: (a: Account) => void
}

export function AccountsTable({ accounts, holdingsCount, onEdit }: Props) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
            {['名稱', '類型', '機構', '備註', '持倉數'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs text-[var(--color-muted)] font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.map((a, i) => {
            const count = holdingsCount[a.id] ?? 0
            return (
              <tr key={a.id} onClick={() => onEdit(a)}
                className={`cursor-pointer ${i < accounts.length - 1 ? 'border-b border-[var(--color-border)]' : ''}
                  hover:bg-[var(--color-bg)] transition-colors`}>
                <td className="px-4 py-3 whitespace-nowrap font-medium">{a.name}</td>
                <td className="px-4 py-3 text-[var(--color-muted)] whitespace-nowrap">
                  {TYPE_LABELS[a.accountType] ?? a.accountType}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{a.institution ?? '—'}</td>
                <td className="px-4 py-3 text-[var(--color-muted)]">{a.note ?? '—'}</td>
                <td className="px-4 py-3">{count}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
