'use client'
import { useTranslations } from 'next-intl'
import type { Account, AccountType } from '@/lib/types'

interface Props {
  accounts: Account[]
  holdingsCount: Record<string, number>
  onEdit: (a: Account) => void
}

export function AccountsTable({ accounts, holdingsCount, onEdit }: Props) {
  const t = useTranslations()
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
            <th className="px-4 py-3 text-left text-xs text-[var(--color-muted)] font-medium">{t('accounts.columns.name')}</th>
            <th className="px-4 py-3 text-left text-xs text-[var(--color-muted)] font-medium">{t('accounts.columns.type')}</th>
            <th className="px-4 py-3 text-left text-xs text-[var(--color-muted)] font-medium hidden md:table-cell">{t('accounts.columns.institution')}</th>
            <th className="px-4 py-3 text-left text-xs text-[var(--color-muted)] font-medium hidden md:table-cell">{t('accounts.columns.note')}</th>
            <th className="px-4 py-3 text-left text-xs text-[var(--color-muted)] font-medium hidden md:table-cell">{t('accounts.columns.holdingsCount')}</th>
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
                  {t(`account.types.${a.accountType}` as Parameters<typeof t>[0], { defaultValue: a.accountType })}
                </td>
                <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">{a.institution ?? '—'}</td>
                <td className="px-4 py-3 text-[var(--color-muted)] hidden md:table-cell">{a.note ?? '—'}</td>
                <td className="px-4 py-3 hidden md:table-cell">{count}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
