'use client'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import type { Asset } from '@/lib/types'

export function AssetsTable({ assets, onDelete }: { assets: Asset[]; onDelete: (id: string) => void }) {
  const cols = ['名稱', '類別', 'Category', 'Sub-kind', 'Symbol', '幣別', '報價']
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b text-[var(--color-muted)]">
          {cols.map(c => <th key={c} className="px-4 py-2 text-left">{c}</th>)}
          <th />
        </tr>
      </thead>
      <tbody>
        {assets.map(a => (
          <tr key={a.id} className="border-b hover:bg-[var(--color-bg)]">
            <td className="px-4 py-2">
              <Link href={`/assets/${a.id}`} className="text-[var(--color-accent)] hover:underline">{a.name}</Link>
            </td>
            <td className="px-4 py-2">{a.assetClass}</td>
            <td className="px-4 py-2">{a.category}</td>
            <td className="px-4 py-2">{a.subKind}</td>
            <td className="px-4 py-2">{a.symbol ?? '—'}</td>
            <td className="px-4 py-2">{a.currencyCode}</td>
            <td className="px-4 py-2">{a.pricingMode}</td>
            <td className="px-4 py-2">
              <button onClick={() => onDelete(a.id)} title="刪除">
                <Trash2 size={14} className="text-[var(--color-muted)] hover:text-[var(--color-coral)]" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
