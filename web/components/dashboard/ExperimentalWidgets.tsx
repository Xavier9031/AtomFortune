'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import useSWR from 'swr'
import { BASE, fetcher, useNetWorthHistory, useCategoryHistory, useRecurringEntries } from '@/lib/api'
import type { Currency, Transaction } from '@/lib/types'

// ─── Shared helpers ───────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  liquid:     '#078080',
  investment: '#7c3aed',
  fixed:      '#1d4ed8',
  receivable: '#0ea5e9',
  debt:       '#f45d48',
}

const CAT_LABEL: Record<string, string> = {
  liquid: '流動資金', investment: '投資', fixed: '固定資產',
  receivable: '應收款', debt: '負債',
}

// FIRE target in each display currency (rough equivalents of ~30M TWD)
const FIRE_TARGET: Record<string, number> = {
  TWD: 30_000_000, USD: 1_000_000, JPY: 150_000_000,
  EUR: 900_000, GBP: 800_000, SGD: 1_350_000,
}

function fmtShort(v: number) {
  const abs = Math.abs(v)
  if (abs >= 1e9)  return (v / 1e9).toFixed(1) + 'B'
  if (abs >= 1e6)  return (v / 1e6).toFixed(1) + 'M'
  if (abs >= 1e3)  return (v / 1e3).toFixed(0) + 'K'
  return v.toFixed(0)
}

function fmtDate(d: string, range: string) {
  return range === '30d' ? d.slice(5) : d.slice(2, 7)
}

const tooltipStyle = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 8, fontSize: 12,
}

type Range = '30d' | '1y' | 'all'

function RangeTabs({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const t = useTranslations('dashboard')
  const labels: Record<Range, string> = { '30d': t('range30d'), '1y': t('range1y'), 'all': t('rangeAll') }
  return (
    <div className="flex gap-1">
      {(['30d', '1y', 'all'] as Range[]).map(r => (
        <button key={r} onClick={() => onChange(r)}
          className={`px-2 py-0.5 text-xs rounded transition-colors
            ${value === r ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}>
          {labels[r]}
        </button>
      ))}
    </div>
  )
}

// ─── Widget 1: FIRE Progress ──────────────────────────────────────────────────

export function FireProgress({ currency }: { currency: Currency }) {
  const { data } = useNetWorthHistory(currency, 'all')
  const { data: allEntries } = useRecurringEntries()
  if (!data?.data?.length) return null

  const pts = data.data
  const current = pts.at(-1)!.netWorth
  const target = FIRE_TARGET[currency] ?? 30_000_000
  const pct = Math.min((current / target) * 100, 100)

  // Monthly growth rate from recent 90 data points
  const recent = pts.slice(-90)
  const monthlyRate = recent.length > 10
    ? (recent.at(-1)!.netWorth - recent[0]!.netWorth) / (recent.length / 30.44)
    : 0
  const monthsLeft = monthlyRate > 0 ? (target - current) / monthlyRate : null

  // Monthly cashflow from recurring entries (TWD, no FX conversion)
  const today = new Date().toISOString().slice(0, 10)
  const active = (allEntries ?? []).filter(e =>
    e.effectiveFrom <= today && (!e.effectiveTo || e.effectiveTo >= today)
  )
  const monthlyIncome = active.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0)
  const monthlyExpense = active.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0)
  const monthlyNet = monthlyIncome - monthlyExpense
  const monthsFromCashflow = monthlyNet > 0 ? (target - current) / monthlyNet : null

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold">財務自由進度</h3>
        <span className="text-xs text-[var(--color-muted)]">
          目標 {fmtShort(target)} {currency}
        </span>
      </div>

      <div className="h-2 bg-[var(--color-bg)] rounded-full overflow-hidden mb-2">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: 'var(--color-accent)' }} />
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
        <span className="tabular-nums font-medium text-[var(--color-text)]">{pct.toFixed(1)}%</span>
        {monthsLeft ? (
          <span>
            近期增速預估{' '}
            <span className="text-[var(--color-text)] font-medium">
              {monthsLeft >= 12 ? `${(monthsLeft / 12).toFixed(1)} 年` : `${Math.round(monthsLeft)} 個月`}
            </span>
          </span>
        ) : <span>增速計算中…</span>}
        <span className="tabular-nums">{fmtShort(current)}</span>
      </div>

      {monthlyRate > 0 && (
        <p className="text-xs text-[var(--color-muted)] mt-1">
          近 3 個月月均增 +{fmtShort(monthlyRate)} {currency}
        </p>
      )}

      {/* ── Recurring cashflow section ── */}
      {active.length > 0 ? (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[var(--color-muted)]">月淨現金流（自動記）</span>
            <span className={`font-medium tabular-nums ${monthlyNet >= 0 ? 'text-green-500' : 'text-red-400'}`}>
              {monthlyNet >= 0 ? '+' : ''}{fmtShort(monthlyNet)} TWD
            </span>
          </div>
          <div className="flex gap-4 text-xs text-[var(--color-muted)]">
            <span className="text-green-500">↑ +{fmtShort(monthlyIncome)}</span>
            <span className="text-red-400">↓ -{fmtShort(monthlyExpense)}</span>
          </div>
          {monthsFromCashflow ? (
            <p className="text-xs text-[var(--color-muted)] mt-1.5">
              按現金流計算約{' '}
              <span className="text-[var(--color-text)] font-medium">
                {monthsFromCashflow >= 12
                  ? `${(monthsFromCashflow / 12).toFixed(1)} 年`
                  : `${Math.round(monthsFromCashflow)} 個月`}
              </span>
              {' '}後達成
            </p>
          ) : monthlyNet <= 0 ? (
            <p className="text-xs text-red-400 mt-1.5">現金流為負，建議檢視支出</p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-[var(--color-muted)] mt-3 pt-3 border-t border-[var(--color-border)]">
          前往資產詳情頁設定「自動記」以啟用現金流預測
        </p>
      )}
    </div>
  )
}

// ─── Widget 2: Monthly delta (waterfall) ─────────────────────────────────────

export function MonthlyDelta({ currency }: { currency: Currency }) {
  const { data } = useCategoryHistory(currency, '30d')
  if (!data?.data?.length || data.data.length < 2) return null

  const first = data.data[0]
  const last  = data.data[data.data.length - 1]

  // Include debt (already negative from API)
  const allCats = ['liquid', 'investment', 'fixed', 'debt']
  const deltas = allCats
    .map(cat => ({ cat, delta: ((last[cat] as number) ?? 0) - ((first[cat] as number) ?? 0) }))
    .filter(d => Math.abs(d.delta) > 100)

  const netDelta = deltas.reduce((s, d) => s + d.delta, 0)

  // For bar chart: positive = right, negative = left (symmetric around 0)
  const maxAbs = Math.max(...deltas.map(d => Math.abs(d.delta)), 1)

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-semibold">近 30 天淨值變化</h3>
        <span className={`text-sm font-bold tabular-nums ${netDelta >= 0 ? 'text-green-500' : 'text-red-400'}`}>
          {netDelta >= 0 ? '+' : ''}{fmtShort(netDelta)}
        </span>
      </div>

      <div className="space-y-2.5">
        {deltas.map(({ cat, delta }) => {
          const barPct = (Math.abs(delta) / maxAbs) * 45  // max 45% of half-width
          return (
            <div key={cat} className="flex items-center gap-2 text-xs">
              <span className="text-[var(--color-muted)] w-14 shrink-0 text-right">
                {CAT_LABEL[cat] ?? cat}
              </span>

              {/* Symmetric bar */}
              <div className="flex-1 flex items-center">
                <div className="w-1/2 flex justify-end">
                  {delta < 0 && (
                    <div className="h-4 rounded-l"
                      style={{ width: `${barPct}%`, background: CAT_COLOR[cat] ?? '#888', opacity: 0.85 }} />
                  )}
                </div>
                <div className="w-px h-4 bg-[var(--color-border)] shrink-0" />
                <div className="w-1/2 flex justify-start">
                  {delta > 0 && (
                    <div className="h-4 rounded-r"
                      style={{ width: `${barPct}%`, background: CAT_COLOR[cat] ?? '#888', opacity: 0.85 }} />
                  )}
                </div>
              </div>

              <span className={`tabular-nums w-14 ${delta >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                {delta >= 0 ? '+' : ''}{fmtShort(delta)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Widget 3: Net Worth + Transaction Markers ────────────────────────────────

export function AnnotatedNetWorth({ currency }: { currency: Currency }) {
  const t = useTranslations('dashboard')
  const [range, setRange] = useState<Range>('1y')
  const { data: nwData } = useNetWorthHistory(currency, range)
  const { data: txns } = useSWR<Transaction[]>(`${BASE}/transactions`, fetcher)

  const dataStart = nwData?.data?.[0]?.date
  // Map snapshot dates by month (YYYY-MM) so transaction dates snap to the nearest snapshot
  const snapByMonth = new Map<string, string>()
  for (const d of nwData?.data ?? []) snapByMonth.set(d.date.slice(0, 7), d.date)

  const markerDates = [...new Set(
    (txns ?? [])
      .filter(t => !dataStart || t.txnDate >= dataStart)
      .map(t => snapByMonth.get(t.txnDate.slice(0, 7)))
      .filter((d): d is string => !!d)
  )]

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{t('annotatedNetWorthTitle')}</h3>
        <RangeTabs value={range} onChange={setRange} />
      </div>

      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={nwData?.data ?? []} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
              tickFormatter={d => fmtDate(d, range)} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted)' }} tickFormatter={fmtShort} width={48} />
            <Tooltip
              formatter={(v: any) => [fmtShort(Number(v)), t('netWorth')]}
              labelStyle={{ color: 'var(--color-text)' }}
              contentStyle={tooltipStyle}
            />
            {markerDates.map(date => (
              <ReferenceLine key={date} x={date}
                stroke="var(--color-accent)" strokeDasharray="3 3" strokeOpacity={0.45} />
            ))}
            <Line type="monotone" dataKey="netWorth" stroke="var(--color-accent)"
              strokeWidth={2} dot={false} activeDot={{ r: 4 }}
              animationBegin={0} animationDuration={800} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-[var(--color-muted)] mt-2">
        {t('txnMarkers', { count: markerDates.length })}
      </p>
    </div>
  )
}

// ─── Widget 4: Stacked Asset Area ─────────────────────────────────────────────

export function StackedAssetArea({ currency }: { currency: Currency }) {
  const t = useTranslations('dashboard')
  const tAsset = useTranslations('asset')
  const [range, setRange] = useState<Range>('1y')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const { data } = useCategoryHistory(currency, range)

  const assetCats = ['liquid', 'investment', 'fixed', 'receivable']
  const active = assetCats.filter(cat => data?.data.some(d => (d[cat] as number) > 0))
  const hasDebt = data?.data.some(d => (d['debt'] as number) < 0)
  const allCats = [...active, ...(hasDebt ? ['debt'] : [])]

  const getCatLabel = (key: string) => tAsset(`categories.${key}` as any) ?? key
  const toggle = (cat: string) => setHidden(prev => {
    const next = new Set(prev)
    next.has(cat) ? next.delete(cat) : next.add(cat)
    return next
  })

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{t('stackedAreaTitle')}</h3>
        <RangeTabs value={range} onChange={setRange} />
      </div>

      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data?.data ?? []} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
              tickFormatter={d => fmtDate(d, range)} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted)' }} tickFormatter={fmtShort} width={48} />
            <Tooltip
              formatter={(v: any, name: any) => [fmtShort(Number(v)), getCatLabel(name as string)]}
              labelStyle={{ color: 'var(--color-text)' }}
              contentStyle={tooltipStyle}
            />
            {active.filter(cat => !hidden.has(cat)).map(cat => (
              <Area key={cat} type="monotone" dataKey={cat} stackId="a"
                stroke={CAT_COLOR[cat]} fill={CAT_COLOR[cat]}
                fillOpacity={0.6} strokeWidth={1.5} dot={false}
                animationBegin={0} animationDuration={800} />
            ))}
            {hasDebt && !hidden.has('debt') && (
              <Area type="monotone" dataKey="debt"
                stroke={CAT_COLOR.debt} fill={CAT_COLOR.debt}
                fillOpacity={0.5} strokeWidth={1.5} dot={false}
                animationBegin={0} animationDuration={800} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-3 mt-2 justify-center flex-wrap">
        {allCats.map(cat => {
          const isHidden = hidden.has(cat)
          return (
            <button key={cat} onClick={() => toggle(cat)}
              className="flex items-center gap-1.5 transition-opacity"
              style={{ opacity: isHidden ? 0.3 : 1 }}>
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: CAT_COLOR[cat] }} />
              <span className="text-xs text-[var(--color-muted)]">{getCatLabel(cat)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function ExperimentalWidgets({ currency }: { currency: Currency }) {
  return (
    <div className="space-y-4 mt-6">
      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--color-border)]" />
        <span className="text-xs text-[var(--color-muted)] px-3 py-1
          border border-[var(--color-border)] rounded-full shrink-0">
          預覽功能
        </span>
        <div className="h-px flex-1 bg-[var(--color-border)]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FireProgress currency={currency} />
        <MonthlyDelta currency={currency} />
      </div>
    </div>
  )
}
