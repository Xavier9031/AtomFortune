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
    <>
      {/* ── Mobile: card list ── */}
      <div className="md:hidden space-y-2">
        {accounts.map(a => {
          const count = holdingsCount[a.id] ?? 0
          return (
            <div key={a.id} onClick={() => onEdit(a)}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 cursor-pointer
                active:bg-[var(--color-bg)] transition-colors">
              <div className="flex justify-between items-start">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{a.name}</p>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">
                    {t(`account.types.${a.accountType}` as Parameters<typeof t>[0], { defaultValue: a.accountType })}
                    {a.institution ? ` · ${a.institution}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm text-[var(--color-muted)]">{count} {t('accounts.columns.holdingsCount')}</p>
                </div>
              </div>
              {a.note && <p className="text-xs text-[var(--color-muted)] mt-1.5">{a.note}</p>}
            </div>
          )
        })}
      </div>

      {/* ── Desktop: table ── */}
      <div className="hidden md:block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
              {[
                t('accounts.columns.name'),
                t('accounts.columns.type'),
                t('accounts.columns.institution'),
                t('accounts.columns.note'),
                t('accounts.columns.holdingsCount'),
              ].map(h => (
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
                    {t(`account.types.${a.accountType}` as Parameters<typeof t>[0], { defaultValue: a.accountType })}
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
    </>
  )
}
