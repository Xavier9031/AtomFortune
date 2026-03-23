'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { BASE, fetcher } from '@/lib/api'
import type { AllocationCategory, Category, Holding } from '@/lib/types'
import { getHoldingUnit } from '@/lib/utils'

const CAT_COLORS: Record<Category, string> = {
  liquid: '#22c55e', investment: '#6366f1', fixed: '#8b5cf6',
  receivable: '#38bdf8', debt: '#94a3b8',
}
const CAT_LABELS: Record<Category, string> = {
  liquid: '流動資金', investment: '投資', fixed: '固定資產',
  receivable: '應收款', debt: '負債',
}

type GroupBy = 'account' | 'asset'

function fmt(v: number, cur: string) {
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(v) + ' ' + cur
}

function PctBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1 rounded-full bg-[var(--color-bg)] overflow-hidden mt-1">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
    </div>
  )
}

interface Props {
  categories: AllocationCategory[]
  totalAssets: number
  totalLiabilities: number
  displayCurrency: string
}

export default function AllocationBreakdown({ categories, totalAssets, totalLiabilities, displayCurrency }: Props) {
  const { data: holdings } = useSWR<Holding[]>(`${BASE}/holdings`, fetcher)
  const [path, setPath] = useState<string[]>([])
  const [groupBy, setGroupBy] = useState<GroupBy>('account')

  // ─── Level 0: 資產 vs 負債 ───
  if (path.length === 0) {
    const assetCats = categories.filter(c => c.category !== 'debt')
    const liabCats = categories.filter(c => c.category === 'debt')
    const classes = [
      { key: 'asset', label: '資產', value: totalAssets, cats: assetCats },
      { key: 'liability', label: '負債', value: totalLiabilities, cats: liabCats },
    ].filter(g => g.value > 0)

    return (
      <div className="space-y-3">
        {classes.map(g => (
          <button key={g.key} onClick={() => setPath([g.key])}
            className="w-full text-left rounded-xl border border-[var(--color-border)] p-4
              hover:bg-[var(--color-bg)] transition-colors group">
            <div className="flex justify-between items-baseline mb-3">
              <span className="font-semibold text-sm">{g.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{fmt(g.value, displayCurrency)}</span>
                <span className="text-xs text-[var(--color-muted)] group-hover:text-[var(--color-text)]">›</span>
              </div>
            </div>
            <div className="space-y-2">
              {g.cats.map(c => {
                const pct = g.value > 0 ? (c.value / g.value) * 100 : 0
                return (
                  <div key={c.category}>
                    <div className="flex justify-between text-xs text-[var(--color-muted)]">
                      <span style={{ color: CAT_COLORS[c.category] }}>{c.label}</span>
                      <span>{fmt(c.value, displayCurrency)} · {pct.toFixed(1)}%</span>
                    </div>
                    <PctBar pct={pct} color={CAT_COLORS[c.category]} />
                  </div>
                )
              })}
            </div>
          </button>
        ))}
      </div>
    )
  }

  const isAsset = path[0] === 'asset'
  const classLabel = isAsset ? '資產' : '負債'
  const classTotal = isAsset ? totalAssets : totalLiabilities

  // ─── Level 1: 類別 ───
  if (path.length === 1) {
    const cats = isAsset
      ? categories.filter(c => c.category !== 'debt')
      : categories.filter(c => c.category === 'debt')

    return (
      <div className="space-y-3">
        <Breadcrumb path={path} setPath={setPath} />
        <div className="grid grid-cols-2 gap-3">
          {cats.map(c => {
            const pct = classTotal > 0 ? (c.value / classTotal) * 100 : 0
            return (
              <button key={c.category} onClick={() => setPath([path[0], c.category])}
                className="text-left rounded-xl border border-[var(--color-border)] p-4
                  hover:bg-[var(--color-bg)] transition-colors group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: CAT_COLORS[c.category] }}>
                    {CAT_LABELS[c.category]}
                  </span>
                  <span className="text-xs text-[var(--color-muted)] group-hover:text-[var(--color-text)]">›</span>
                </div>
                <div className="text-sm font-semibold mt-1.5">{fmt(c.value, displayCurrency)}</div>
                <div className="text-xs text-[var(--color-muted)]">{pct.toFixed(1)}%</div>
                <PctBar pct={pct} color={CAT_COLORS[c.category]} />
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── Level 2: 明細 (by account / by asset) ───
  if (path.length === 2) {
    const cat = path[1] as Category
    const catData = categories.find(c => c.category === cat)
    const catHoldings = (holdings ?? []).filter(h => h.category === cat)

    // Distribute live AllocationItem values proportionally by quantity across holdings
    const assetTotalQty = new Map<string, number>()
    for (const h of catHoldings) {
      assetTotalQty.set(h.assetId, (assetTotalQty.get(h.assetId) ?? 0) + Number(h.quantity))
    }
    const liveValues = new Map<string, number>() // key: assetId+accountId
    for (const h of catHoldings) {
      const item = catData?.items.find(i => i.assetId === h.assetId)
      const totalQty = assetTotalQty.get(h.assetId) ?? 1
      const ratio = totalQty > 0 ? Number(h.quantity) / totalQty : 0
      liveValues.set(h.assetId + h.accountId, item ? item.value * ratio : (h.latestValueInBase ?? 0))
    }

    return (
      <div className="space-y-3">
        <Breadcrumb path={path} setPath={setPath} catLabel={CAT_LABELS[cat]}
          total={catData ? fmt(catData.value, displayCurrency) : undefined} />

        <div className="flex gap-1 p-0.5 bg-[var(--color-bg)] rounded-lg w-fit">
          {(['account', 'asset'] as GroupBy[]).map(g => (
            <button key={g} onClick={() => setGroupBy(g)}
              className={`px-3 py-1 text-xs rounded-md transition-colors
                ${groupBy === g
                  ? 'bg-[var(--color-surface)] shadow-sm font-semibold'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}>
              {g === 'account' ? '按帳戶' : '按資產'}
            </button>
          ))}
        </div>

        {groupBy === 'account'
          ? <ByAccount holdings={catHoldings} liveValues={liveValues} displayCurrency={displayCurrency} />
          : <ByAsset holdings={catHoldings} liveValues={liveValues} displayCurrency={displayCurrency} />}
      </div>
    )
  }

  return null
}

function Breadcrumb({ path, setPath, catLabel, total }: {
  path: string[]; setPath: (p: string[]) => void; catLabel?: string; total?: string
}) {
  const isAsset = path[0] === 'asset'
  return (
    <div className="flex items-center gap-1 text-sm flex-wrap">
      <button onClick={() => setPath([])} className="text-[var(--color-muted)] hover:text-[var(--color-text)]">全覽</button>
      <span className="text-[var(--color-muted)]">›</span>
      {path.length === 1
        ? <span className="font-medium">{isAsset ? '資產' : '負債'}</span>
        : <>
            <button onClick={() => setPath([path[0]])} className="text-[var(--color-muted)] hover:text-[var(--color-text)]">
              {isAsset ? '資產' : '負債'}
            </button>
            <span className="text-[var(--color-muted)]">›</span>
            <span className="font-medium">{catLabel}</span>
          </>}
      {total && <span className="ml-auto text-sm font-semibold">{total}</span>}
    </div>
  )
}

function ByAccount({ holdings, liveValues, displayCurrency }: { holdings: Holding[]; liveValues: Map<string, number>; displayCurrency: string }) {
  const groups = new Map<string, { name: string; institution: string | null; total: number; rows: Holding[] }>()
  for (const h of holdings) {
    if (!groups.has(h.accountId)) groups.set(h.accountId, {
      name: h.accountName, institution: h.institution ?? null, total: 0, rows: [],
    })
    const g = groups.get(h.accountId)!
    g.rows.push(h)
    g.total += liveValues.get(h.assetId + h.accountId) ?? 0
  }
  if (groups.size === 0) return <Empty />

  return (
    <div className="space-y-2">
      {[...groups.values()].sort((a, b) => b.total - a.total).map(g => (
        <div key={g.name + g.institution} className="rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div className="px-4 py-3 bg-[var(--color-bg)] flex justify-between items-center">
            <div>
              <span className="font-medium text-sm">{g.name}</span>
              {g.institution && <span className="text-xs text-[var(--color-muted)] ml-2">{g.institution}</span>}
            </div>
            <span className="text-sm font-semibold">{fmt(g.total, displayCurrency)}</span>
          </div>
          {g.rows.map((h, i) => (
            <HoldingRow key={h.assetId + h.accountId} h={h}
              value={liveValues.get(h.assetId + h.accountId) ?? 0}
              accountTotal={g.total}
              displayCurrency={displayCurrency}
              showLabel={h.assetName}
              isLast={i === g.rows.length - 1} />
          ))}
        </div>
      ))}
    </div>
  )
}

function ByAsset({ holdings, liveValues, displayCurrency }: { holdings: Holding[]; liveValues: Map<string, number>; displayCurrency: string }) {
  if (holdings.length === 0) return <Empty />

  // Group by assetId, summing values across accounts
  const groups = new Map<string, {
    representative: Holding; total: number; rows: { h: Holding; value: number }[]
  }>()
  for (const h of holdings) {
    const val = liveValues.get(h.assetId + h.accountId) ?? 0
    if (!groups.has(h.assetId)) {
      groups.set(h.assetId, { representative: h, total: 0, rows: [] })
    }
    const g = groups.get(h.assetId)!
    g.total += val
    g.rows.push({ h, value: val })
  }

  return (
    <div className="space-y-2">
      {[...groups.values()].sort((a, b) => b.total - a.total).map(({ representative: h, total, rows }) => (
        <div key={h.assetId} className="rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div className="px-4 py-3 bg-[var(--color-bg)] flex justify-between items-center">
            <span className="font-medium text-sm">{h.assetName}</span>
            <span className="text-sm font-semibold">{fmt(total, displayCurrency)}</span>
          </div>
          {rows.map(({ h: rh, value }, i) => {
            const pct = total > 0 ? (value / total) * 100 : 0
            return (
              <div key={rh.accountId}
                className={`px-4 py-2.5 text-sm ${i < rows.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-muted)]">
                    {rh.accountName}{rh.institution ? ` · ${rh.institution}` : ''}
                  </span>
                  <ValueBlock h={rh} value={value} displayCurrency={displayCurrency} />
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-[var(--color-bg)] overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <span className="text-xs text-[var(--color-muted)] w-10 text-right">{pct.toFixed(1)}%</span>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function HoldingRow({ h, value, accountTotal, displayCurrency, showLabel, isLast }: {
  h: Holding; value: number; accountTotal: number; displayCurrency: string; showLabel: string; isLast: boolean
}) {
  const pct = accountTotal > 0 ? (value / accountTotal) * 100 : 0
  return (
    <div className={`px-4 py-2.5 text-sm ${!isLast ? 'border-b border-[var(--color-border)]' : ''}`}>
      <div className="flex justify-between items-center">
        <span className="text-[var(--color-muted)]">{showLabel}</span>
        <ValueBlock h={h} value={value} displayCurrency={displayCurrency} />
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-[var(--color-bg)] overflow-hidden">
          <div className="h-full rounded-full bg-green-400 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <span className="text-xs text-[var(--color-muted)] w-10 text-right">{pct.toFixed(1)}%</span>
      </div>
    </div>
  )
}

function ValueBlock({ h, value, displayCurrency }: { h: Holding; value: number; displayCurrency: string }) {
  return (
    <div className="text-right">
      <div className="text-sm font-medium">{fmt(value, displayCurrency)}</div>
      {h.currencyCode !== displayCurrency && (
        <div className="text-xs text-[var(--color-muted)]">
          {new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 6 }).format(h.quantity)} {getHoldingUnit(h)}
        </div>
      )}
    </div>
  )
}

function Empty() {
  return <p className="text-sm text-[var(--color-muted)] text-center py-6">無持倉資料</p>
}
