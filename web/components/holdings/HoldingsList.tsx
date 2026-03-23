'use client'
import { useMemo } from 'react'
import type { Holding } from '@/lib/types'

interface Props {
  holdings: Holding[]
  onRowClick: (h: Holding) => void
}

export function HoldingsList({ holdings, onRowClick }: Props) {
  const byAccount = useMemo(() => {
    const map = new Map<string, { name: string; items: Holding[] }>()
    for (const h of holdings) {
      if (!map.has(h.accountId))
        map.set(h.accountId, { name: h.accountName, items: [] })
      map.get(h.accountId)!.items.push(h)
    }
    return Array.from(map.values())
  }, [holdings])

  return (
    <div className="space-y-6">
      {byAccount.map(({ name, items }) => (
        <section key={name}>
          <h2 className="text-sm font-semibold text-[var(--color-muted)] uppercase mb-2">{name}</h2>
          <div className="rounded-lg border border-[var(--color-border)] divide-y">
            {items.map(h => (
              <button key={`${h.assetId}-${h.accountId}`}
                className="w-full flex justify-between px-4 py-3 hover:bg-[var(--color-bg)] text-left"
                onClick={() => onRowClick(h)}>
                <span className="font-medium">{h.assetName}</span>
                <span className="text-sm text-[var(--color-muted)]">
                  {h.quantity} | {h.latestValueInBase != null
                    ? h.latestValueInBase.toLocaleString() : '—'}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
