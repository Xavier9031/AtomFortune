'use client'
import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import useSWR from 'swr'
import { BASE, fetcher } from '@/lib/api'
import type { AllocationCategory, Category, Holding } from '@/lib/types'
import { getHoldingUnit, translateUnit } from '@/lib/utils'

const CAT_COLOR: Record<string, string> = {
  liquid:     '#078080',
  investment: '#7c3aed',
  fixed:      '#1d4ed8',
  receivable: '#0ea5e9',
  debt:       '#f45d48',
}

type GroupBy = 'account' | 'asset'

function fmt(v: number, cur: string, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(v) + '\u00a0' + cur
}

// Compact: 1.2M TWD
function fmtShort(v: number, cur: string, locale: string) {
  const abs = Math.abs(v)
  const suffix =
    abs >= 1e12 ? [(v / 1e12).toFixed(1), 'T'] :
    abs >= 1e9  ? [(v / 1e9).toFixed(1),  'B'] :
    abs >= 1e6  ? [(v / 1e6).toFixed(1),  'M'] :
    abs >= 1e3  ? [(v / 1e3).toFixed(0),  'K'] : null
  if (suffix) return suffix[0] + '\u00a0' + suffix[1] + '\u00a0' + cur
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(v) + '\u00a0' + cur
}

interface Props {
  categories: AllocationCategory[]
  totalAssets: number
  totalLiabilities: number
  displayCurrency: string
}

export default function AllocationBreakdown({ categories, totalAssets, totalLiabilities, displayCurrency }: Props) {
  const t = useTranslations('dashboard')
  const tAsset = useTranslations('asset')
  const locale = useLocale()
  const { data: holdings } = useSWR<Holding[]>(`${BASE}/holdings`, fetcher)
  const [selectedCat, setSelectedCat] = useState<Category | null>(null)
  const [hoveredCat, setHoveredCat] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<GroupBy>('account')

  const netWorth = totalAssets - totalLiabilities
  const gross = categories.reduce((s, c) => s + c.value, 0)

  // ─── Overview (donut + legend) ───────────────────────────────────────────
  if (!selectedCat) {
    const donutData = categories.map(c => ({
      ...c, color: CAT_COLOR[c.category] ?? '#888',
    }))

    return (
      <div className="space-y-4">
        {/* Donut + category list */}
        <div className="flex items-center gap-5">

          {/* Donut */}
          <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} dataKey="value"
                  innerRadius={46} outerRadius={64}
                  paddingAngle={2} startAngle={90} endAngle={-270}
                  strokeWidth={0} animationBegin={0} animationDuration={400}>
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color}
                      style={{ cursor: 'pointer', outline: 'none' }}
                      onClick={() => setSelectedCat(entry.category as Category)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any) => fmtShort(Number(v), displayCurrency, locale)}
                  contentStyle={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  itemStyle={{ color: 'var(--color-text)' }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] text-[var(--color-muted)] leading-none mb-0.5">
                {t('netWorth')}
              </span>
              <span className="text-sm font-bold leading-tight text-center px-2">
                {fmtShort(netWorth, displayCurrency, locale)}
              </span>
            </div>
          </div>

          {/* Category legend */}
          <div className="flex-1 space-y-1.5 min-w-0">
            {donutData.map(c => {
              const pct = gross > 0 ? (c.value / gross) * 100 : 0
              const catItems = categories.find(cat => cat.category === c.category)?.items ?? []
              return (
                <div key={c.category} className="relative"
                  onMouseEnter={() => setHoveredCat(c.category)}
                  onMouseLeave={() => setHoveredCat(null)}>
                  <button onClick={() => setSelectedCat(c.category as Category)}
                    className="w-full text-left group">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0 mt-px"
                        style={{ background: c.color }} />
                      <span className="text-xs flex-1 truncate text-[var(--color-muted)]
                        group-hover:text-[var(--color-text)] transition-colors">
                        {tAsset(`categories.${c.category}`)}
                      </span>
                      <span className="text-xs font-medium tabular-nums">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--color-bg)] overflow-hidden ml-4">
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(pct, 100)}%`, background: c.color }} />
                    </div>
                  </button>

                  {hoveredCat === c.category && catItems.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl
                      border border-[var(--color-border)] bg-[var(--color-surface)]
                      shadow-lg p-3 space-y-1.5">
                      {catItems.slice(0, 5).map(item => {
                        const itemPct = c.value > 0 ? (item.value / c.value) * 100 : 0
                        return (
                          <div key={item.assetId} className="space-y-1">
                            <div className="flex justify-between items-baseline text-xs gap-2">
                              <span className="text-[var(--color-muted)] truncate">{item.name}</span>
                              <span className="tabular-nums shrink-0 font-medium">
                                {fmt(item.value, displayCurrency, locale)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 h-1 rounded-full bg-[var(--color-bg)] overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${Math.min(itemPct, 100)}%`, background: c.color, opacity: 0.7 }} />
                              </div>
                              <span className="text-[10px] text-[var(--color-muted)] tabular-nums w-8 text-right shrink-0">
                                {itemPct.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        )
                      })}
                      {catItems.length > 5 && (
                        <p className="text-xs text-[var(--color-muted)]">
                          +{catItems.length - 5} {t('moreItems')}
                        </p>
                      )}
                      <button
                        onClick={() => setSelectedCat(c.category as Category)}
                        className="text-xs pt-1 border-t border-[var(--color-border)] w-full text-left"
                        style={{ color: c.color }}>
                        {t('viewDetail')} →
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Asset / Liability summary pills */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: t('assets'), value: totalAssets, muted: false },
            { label: t('liabilities'), value: totalLiabilities, red: true },
          ].map(({ label, value, red }) => (
            <div key={label} className="rounded-xl border border-[var(--color-border)]
              bg-[var(--color-bg)] px-3 py-2.5">
              <p className="text-xs text-[var(--color-muted)] mb-0.5">{label}</p>
              <p className={`text-sm font-semibold tabular-nums ${red ? 'text-red-400' : ''}`}>
                {fmtShort(value, displayCurrency, locale)}
              </p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── Detail (by account / by asset) ──────────────────────────────────────
  const catData = categories.find(c => c.category === selectedCat)
  const catHoldings = (holdings ?? []).filter(h => h.category === selectedCat)

  const assetTotalQty = new Map<string, number>()
  for (const h of catHoldings) {
    assetTotalQty.set(h.assetId, (assetTotalQty.get(h.assetId) ?? 0) + Number(h.quantity))
  }
  const liveValues = new Map<string, number>()
  for (const h of catHoldings) {
    const item = catData?.items.find(i => i.assetId === h.assetId)
    const totalQty = assetTotalQty.get(h.assetId) ?? 1
    const ratio = totalQty > 0 ? Number(h.quantity) / totalQty : 0
    liveValues.set(h.assetId + h.accountId, item ? item.value * ratio : (h.latestValueInBase ?? 0))
  }

  const color = CAT_COLOR[selectedCat] ?? '#888'

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button onClick={() => setSelectedCat(null)}
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
          {t('allocationOverview')}
        </button>
        <span className="text-[var(--color-muted)] text-xs">›</span>
        <span className="text-xs font-semibold" style={{ color }}>
          {tAsset(`categories.${selectedCat}`)}
        </span>
        {catData && (
          <span className="ml-auto text-xs font-semibold tabular-nums">
            {fmt(catData.value, displayCurrency, locale)}
          </span>
        )}
      </div>

      {/* Group-by toggle */}
      <div className="flex gap-1 p-0.5 bg-[var(--color-bg)] rounded-lg w-fit">
        {(['account', 'asset'] as GroupBy[]).map(g => (
          <button key={g} onClick={() => setGroupBy(g)}
            className={`px-3 py-1 text-xs rounded-md transition-colors
              ${groupBy === g
                ? 'bg-[var(--color-surface)] shadow-sm font-semibold'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}>
            {g === 'account' ? t('byAccount') : t('byAsset')}
          </button>
        ))}
      </div>

      {groupBy === 'account'
        ? <ByAccount holdings={catHoldings} liveValues={liveValues}
            displayCurrency={displayCurrency} locale={locale} />
        : <ByAsset holdings={catHoldings} liveValues={liveValues}
            displayCurrency={displayCurrency} locale={locale} />}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ByAccount({ holdings, liveValues, displayCurrency, locale }: {
  holdings: Holding[]; liveValues: Map<string, number>; displayCurrency: string; locale: string
}) {
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
            <span className="text-sm font-semibold tabular-nums">{fmt(g.total, displayCurrency, locale)}</span>
          </div>
          {g.rows.map((h, i) => (
            <HoldingRow key={h.assetId + h.accountId} h={h}
              value={liveValues.get(h.assetId + h.accountId) ?? 0}
              groupTotal={g.total}
              displayCurrency={displayCurrency}
              locale={locale}
              label={h.assetName}
              isLast={i === g.rows.length - 1} />
          ))}
        </div>
      ))}
    </div>
  )
}

function ByAsset({ holdings, liveValues, displayCurrency, locale }: {
  holdings: Holding[]; liveValues: Map<string, number>; displayCurrency: string; locale: string
}) {
  if (holdings.length === 0) return <Empty />

  const groups = new Map<string, { rep: Holding; total: number; rows: { h: Holding; value: number }[] }>()
  for (const h of holdings) {
    const val = liveValues.get(h.assetId + h.accountId) ?? 0
    if (!groups.has(h.assetId)) groups.set(h.assetId, { rep: h, total: 0, rows: [] })
    const g = groups.get(h.assetId)!
    g.total += val
    g.rows.push({ h, value: val })
  }

  return (
    <div className="space-y-2">
      {[...groups.values()].sort((a, b) => b.total - a.total).map(({ rep, total, rows }) => (
        <div key={rep.assetId} className="rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div className="px-4 py-3 bg-[var(--color-bg)] flex justify-between items-center">
            <span className="font-medium text-sm">{rep.assetName}</span>
            <span className="text-sm font-semibold tabular-nums">{fmt(total, displayCurrency, locale)}</span>
          </div>
          {rows.map(({ h, value }, i) => (
            <HoldingRow key={h.accountId} h={h}
              value={value} groupTotal={total}
              displayCurrency={displayCurrency}
              locale={locale}
              label={`${h.accountName}${h.institution ? ' · ' + h.institution : ''}`}
              isLast={i === rows.length - 1} />
          ))}
        </div>
      ))}
    </div>
  )
}

function HoldingRow({ h, value, groupTotal, displayCurrency, locale, label, isLast }: {
  h: Holding; value: number; groupTotal: number; displayCurrency: string
  locale: string; label: string; isLast: boolean
}) {
  const tRoot = useTranslations()
  const pct = groupTotal > 0 ? (value / groupTotal) * 100 : 0
  return (
    <div className={`px-4 py-2.5 text-sm ${!isLast ? 'border-b border-[var(--color-border)]' : ''}`}>
      <div className="flex justify-between items-center">
        <span className="text-[var(--color-muted)]">{label}</span>
        <div className="text-right">
          <div className="text-sm font-medium tabular-nums">{fmt(value, displayCurrency, locale)}</div>
          {h.currencyCode !== displayCurrency && (
            <div className="text-xs text-[var(--color-muted)]">
              {`${new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(h.quantity)}\u00a0${translateUnit(getHoldingUnit(h), tRoot)}`}
            </div>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-[var(--color-bg)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--color-accent)] transition-all"
            style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <span className="text-xs text-[var(--color-muted)] w-10 text-right tabular-nums">{pct.toFixed(1)}%</span>
      </div>
    </div>
  )
}

function Empty() {
  const t = useTranslations('dashboard')
  return <p className="text-sm text-[var(--color-muted)] text-center py-6">{t('noHoldingData')}</p>
}
