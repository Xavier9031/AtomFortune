'use client'
import { Pencil, Trash2 } from 'lucide-react'
import type { Account } from '@/lib/types'

interface Props {
  accounts: Account[]
  holdingsCount: Record<string, number>
  onEdit: (a: Account) => void
  onDelete: (id: string) => void
}

export function AccountsTable({ accounts, holdingsCount, onEdit, onDelete }: Props) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b text-[var(--color-muted)]">
          {['名稱', '類型', '機構', '備註', '持倉數', ''].map(h => (
            <th key={h} className="px-4 py-2 text-left">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {accounts.map(a => {
          const count = holdingsCount[a.id] ?? 0
          return (
            <tr key={a.id} className="border-b hover:bg-[var(--color-bg)]">
              <td className="px-4 py-2 font-medium">{a.name}</td>
              <td className="px-4 py-2">{a.accountType}</td>
              <td className="px-4 py-2">{a.institution ?? '—'}</td>
              <td className="px-4 py-2 text-[var(--color-muted)]">{a.note ?? '—'}</td>
              <td className="px-4 py-2">{count}</td>
              <td className="px-4 py-2 flex gap-2">
                <button onClick={() => onEdit(a)} title="編輯"><Pencil size={14} /></button>
                <button onClick={() => onDelete(a.id)} disabled={count > 0}
                  title={count > 0 ? '請先移除持倉' : '刪除'} aria-label="刪除"
                  className="disabled:opacity-30 disabled:cursor-not-allowed">
                  <Trash2 size={14} className="text-[var(--color-coral)]" />
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
