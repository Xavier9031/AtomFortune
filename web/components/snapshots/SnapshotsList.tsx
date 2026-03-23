'use client'
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { BASE } from '@/lib/api'
import type { SnapshotItem } from '@/lib/types'

interface SnapshotGrouped { category: string; items: SnapshotItem[] }

const CAT_LABELS: Record<string, string> = {
  liquid: '流動資金', investment: '投資', fixed: '固定資產',
  receivable: '應收款', debt: '負債',
}

const ZERO_DECIMAL = new Set(['TWD', 'JPY', 'KRW'])

function fmtAmount(value: number, currency: string) {
  const decimals = ZERO_DECIMAL.has(currency) ? 0 : 2
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: decimals }).format(value) + ' ' + currency
}

function fmtQty(quantity: number, unit: string | null) {
  const decimals = Number.isInteger(quantity) ? 0 : 4
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: decimals }).format(quantity) + (unit ? ' ' + unit : '')
}

function fmtTWD(v: number) {
  return '≈ ' + new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(v) + ' TWD'
}

interface Props {
  dates: string[]
  onRebuild: (date: string) => void
  onExpand: (date: string) => void
}

function groupByCategory(items: SnapshotItem[]): SnapshotGrouped[] {
  const map = new Map<string, SnapshotItem[]>()
  for (const item of items) {
    const cat = (item as SnapshotItem & { category?: string }).category ?? 'other'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(item)
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }))
}

export function SnapshotsList({ dates, onRebuild, onExpand }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, SnapshotGrouped[]>>({})

  async function toggle(date: string) {
    if (expanded === date) { setExpanded(null); return }
    setExpanded(date)
    onExpand(date)
    if (!details[date]) {
      const res = await fetch(`${BASE}/snapshots/${date}`)
      const data = await res.json()
      const grouped = groupByCategory(data.items as SnapshotItem[])
      setDetails(prev => ({ ...prev, [date]: grouped }))
    }
  }

  return (
    <div className="space-y-2">
      {dates.map(date => (
        <div key={date} className="rounded-lg border border-[var(--color-border)]">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => toggle(date)} className="font-medium">{date}</button>
            <button onClick={() => onRebuild(date)} title="重建快照"
              className="text-[var(--color-muted)] hover:text-[var(--color-accent)]">
              <RefreshCw size={14} />
            </button>
          </div>
          {expanded === date && details[date] && (
            <div className="border-t px-4 py-3 space-y-4">
              {details[date].map(({ category, items }) => (
                <div key={category}>
                  <p className="text-xs font-semibold text-[var(--color-muted)] mb-1">
                    {CAT_LABELS[category] ?? category}
                  </p>
                  {items.map(item => {
                    // Liquid: primary = amount in native currency (quantity × price)
                    // Investment/others with unit: primary = quantity + unit, secondary = TWD
                    const isLiquid = category === 'liquid'
                    return (
                      <div key={`${item.assetId}-${item.accountId}`}
                        className="flex justify-between text-sm py-1">
                        <span>{item.assetName} · {item.accountName}</span>
                        <div className="text-right font-mono">
                          {isLiquid ? (
                            <>
                              <div>{fmtAmount(item.quantity * item.price, item.currencyCode)}</div>
                              {item.currencyCode !== 'TWD' && (
                                <div className="text-xs text-[var(--color-muted)]">{fmtTWD(item.valueInBase)}</div>
                              )}
                            </>
                          ) : (
                            <>
                              <div>{fmtQty(item.quantity, item.unit)}</div>
                              <div className="text-xs text-[var(--color-muted)]">{fmtTWD(item.valueInBase)}</div>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
