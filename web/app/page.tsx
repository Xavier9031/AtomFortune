'use client'
import { useTranslations } from 'next-intl'
import { useCurrency } from '@/context/CurrencyContext'
import { useLiveDashboard } from '@/lib/api'
import NetWorthHeader from '@/components/dashboard/NetWorthHeader'
import AllocationBreakdown from '@/components/dashboard/AllocationBreakdown'
import ExperimentalWidgets, { AnnotatedNetWorth, StackedAssetArea } from '@/components/dashboard/ExperimentalWidgets'
import type { DashboardSummary } from '@/lib/types'

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const { currency } = useCurrency()
  const { data: live, isLoading: liveLoading } = useLiveDashboard(currency)

  if (liveLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-20 bg-[var(--color-surface)] rounded-lg" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-64 bg-[var(--color-surface)] rounded-lg" />
          <div className="h-64 bg-[var(--color-surface)] rounded-lg" />
        </div>
      </div>
    )
  }

  if (!live) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
        <div className="text-5xl">📊</div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">{t('noDataTitle')}</h2>
          <p className="text-sm text-[var(--color-muted)] max-w-sm">{t('noDataDesc')}</p>
        </div>
        <ol className="text-left space-y-3 text-sm">
          <li className="flex gap-3 items-start">
            <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center text-xs font-bold">1</span>
            <div>
              <a href="/accounts" className="font-medium text-[var(--color-accent)] hover:underline">{t('goToAccounts')}</a>
              <span className="text-[var(--color-muted)]"> {t('addAccountsDesc')}</span>
            </div>
          </li>
          <li className="flex gap-3 items-start">
            <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center text-xs font-bold">2</span>
            <div>
              <a href="/holdings" className="font-medium text-[var(--color-accent)] hover:underline">{t('goToHoldings')}</a>
              <span className="text-[var(--color-muted)]"> {t('addHoldingsDesc')}</span>
            </div>
          </li>
        </ol>
      </div>
    )
  }

  const liveSummary: DashboardSummary = {
    snapshotDate: '即時',
    displayCurrency: live.displayCurrency,
    netWorth: live.netWorth,
    totalAssets: live.totalAssets,
    totalLiabilities: live.totalLiabilities,
    changeAmount: live.changeAmount,
    changePct: live.changePct,
    prevSnapshotDate: live.prevSnapshotDate ?? null,
    missingAssets: [],
  }

  return (
    <div data-testid="dashboard-root">
      <NetWorthHeader summary={liveSummary} currency={currency} />
      <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
        <h2 className="text-sm font-semibold mb-3">{t('allocation')}</h2>
        <AllocationBreakdown
          categories={live.categories}
          totalAssets={live.totalAssets}
          totalLiabilities={live.totalLiabilities}
          displayCurrency={live.displayCurrency}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <AnnotatedNetWorth currency={currency} />
        <StackedAssetArea currency={currency} />
      </div>
      <ExperimentalWidgets currency={currency} />
    </div>
  )
}
