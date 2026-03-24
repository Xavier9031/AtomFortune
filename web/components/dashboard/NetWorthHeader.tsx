'use client'
import { useTranslations } from 'next-intl'
import type { DashboardSummary, NetWorthPoint } from '@/lib/types'
import type { Currency } from '@/lib/types'
import { formatValue } from '@/lib/utils'
import { useNetWorthHistory } from '@/lib/api'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function nearestBefore(data: NetWorthPoint[], targetDate: string): NetWorthPoint | null {
  let result: NetWorthPoint | null = null
  for (const p of data) {
    if (p.date <= targetDate) result = p
    else break
  }
  return result
}

const PERIODS = [
  { key: 'range30d', days: 30 },
  { key: 'range6m',  days: 180 },
  { key: 'range1y',  days: 365 },
] as const

export default function NetWorthHeader({ summary, currency }: { summary: DashboardSummary; currency: Currency }) {
  const t = useTranslations('dashboard')
  const { data: history } = useNetWorthHistory(currency, 'all')

  const current = summary.netWorth
  const pts = history?.data ?? []

  const changes = PERIODS.map(({ key, days }) => {
    const ref = nearestBefore(pts, daysAgo(days))
    if (!ref || ref.netWorth === 0) return null
    const delta = current - ref.netWorth
    const pct = (delta / Math.abs(ref.netWorth)) * 100
    return { key, delta, pct }
  }).filter((c): c is NonNullable<typeof c> => c !== null)

  return (
    <div className="mb-6">
      <p className="text-sm text-muted mb-1">
        {t('netWorth')} · {summary.snapshotDate === '即時' ? t('realtime') : `${t('asOf')} ${summary.snapshotDate}`}
      </p>
      <div className="flex items-end gap-3">
        <span data-testid="net-worth-value" className="text-4xl font-bold">
          {formatValue(summary.netWorth, summary.displayCurrency)}
        </span>
      </div>
      <div className="flex gap-6 mt-2 text-sm text-muted">
        <span>{t('assets')}: {formatValue(summary.totalAssets, summary.displayCurrency)}</span>
        <span>{t('liabilities')}: <span className="text-coral">{formatValue(summary.totalLiabilities, summary.displayCurrency)}</span></span>
      </div>
      {changes.length > 0 && (
        <div className="flex gap-5 mt-2 flex-wrap">
          {changes.map(({ key, delta, pct }) => {
            const pos = delta >= 0
            return (
              <div key={key} className="flex items-center gap-1.5 text-xs">
                <span className="text-[var(--color-muted)]">{t(key)}</span>
                <span className={pos ? 'text-green-500' : 'text-red-400'}>
                  {pos ? '+' : ''}{formatValue(delta, summary.displayCurrency)}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums
                  ${pos ? 'bg-green-500/10 text-green-500' : 'bg-red-400/10 text-red-400'}`}>
                  {pos ? '+' : ''}{pct.toFixed(1)}%
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
