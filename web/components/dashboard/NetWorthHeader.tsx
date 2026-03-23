'use client'
import type { DashboardSummary } from '@/lib/types'
import { formatValue } from '@/lib/utils'

export default function NetWorthHeader({ summary }: { summary: DashboardSummary }) {
  const positive = (summary.changePct ?? 0) >= 0
  return (
    <div className="mb-6">
      <p className="text-sm text-muted mb-1">
        Net Worth · {summary.snapshotDate === '即時' ? '即時' : `資料截至 ${summary.snapshotDate}`}
      </p>
      <div className="flex items-end gap-3">
        <span data-testid="net-worth-value" className="text-4xl font-bold">
          {formatValue(summary.netWorth, summary.displayCurrency)}
        </span>
        {summary.changePct !== null && (
          <span
            data-testid="change-badge"
            className={`mb-1 px-2 py-0.5 rounded text-sm font-medium ${positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}
          >
            {positive ? '+' : ''}{summary.changePct.toFixed(2)}%
          </span>
        )}
      </div>
      <div className="flex gap-6 mt-2 text-sm text-muted">
        <span>Assets: {formatValue(summary.totalAssets, summary.displayCurrency)}</span>
        <span>Liabilities: <span className="text-coral">{formatValue(summary.totalLiabilities, summary.displayCurrency)}</span></span>
      </div>
    </div>
  )
}
