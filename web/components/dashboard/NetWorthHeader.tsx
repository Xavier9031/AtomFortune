'use client'
import { useTranslations } from 'next-intl'
import type { DashboardSummary } from '@/lib/types'
import { formatValue } from '@/lib/utils'

export default function NetWorthHeader({ summary }: { summary: DashboardSummary }) {
  const t = useTranslations('dashboard')
  const positive = (summary.changePct ?? 0) >= 0
  const hasChange = summary.changePct !== null && summary.changeAmount !== null
  return (
    <div className="mb-6">
      <p className="text-sm text-muted mb-1">
        {t('netWorth')} · {summary.snapshotDate === '即時' ? t('realtime') : `${t('asOf')} ${summary.snapshotDate}`}
      </p>
      <div className="flex items-end gap-3">
        <span data-testid="net-worth-value" className="text-4xl font-bold">
          {formatValue(summary.netWorth, summary.displayCurrency)}
        </span>
        {hasChange && (
          <span
            data-testid="change-badge"
            className={`mb-1 px-2 py-0.5 rounded text-sm font-medium ${positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}
          >
            {positive ? '+' : ''}{summary.changePct!.toFixed(2)}%
          </span>
        )}
      </div>
      <div className="flex gap-6 mt-2 text-sm text-muted">
        <span>{t('assets')}: {formatValue(summary.totalAssets, summary.displayCurrency)}</span>
        <span>{t('liabilities')}: <span className="text-coral">{formatValue(summary.totalLiabilities, summary.displayCurrency)}</span></span>
      </div>
      {hasChange && (
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          {t('vsSnapshot', { date: summary.prevSnapshotDate ?? '' })}
          <span className={positive ? 'text-green-600' : 'text-red-500'}>
            {' '}{positive ? '+' : ''}{formatValue(summary.changeAmount!, summary.displayCurrency)}
          </span>
        </p>
      )}
    </div>
  )
}
