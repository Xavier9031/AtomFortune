'use client'
import { useState } from 'react'
import { useCurrency } from '@/context/CurrencyContext'
import { useDashboardSummary, useAllocation, useNetWorthHistory } from '@/lib/api'
import NetWorthHeader from '@/components/dashboard/NetWorthHeader'
import AllocationTreemap from '@/components/dashboard/AllocationTreemap'
import NetWorthChart from '@/components/dashboard/NetWorthChart'
import HoldingsAccordion from '@/components/dashboard/HoldingsAccordion'
import type { Category } from '@/lib/types'

export default function DashboardPage() {
  const { currency } = useCurrency()
  const { data: summary, isLoading: s1 } = useDashboardSummary(currency)
  const { data: alloc,   isLoading: s2 } = useAllocation(currency)
  const { data: history, isLoading: s3 } = useNetWorthHistory(currency)
  const [activeCat, setActiveCat] = useState<Category | null>(null)

  const isLoading = s1 || s2 || s3

  return (
    <div data-testid="dashboard-root">
      {isLoading && (
        <div data-testid="dashboard-loading" className="animate-pulse space-y-4">
          <div className="h-20 bg-surface rounded-lg" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-64 bg-surface rounded-lg" />
            <div className="h-64 bg-surface rounded-lg" />
          </div>
        </div>
      )}
      {!isLoading && summary && alloc && history && (
        <>
          <NetWorthHeader summary={summary} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-surface rounded-xl p-4 border border-border">
              <h2 className="text-sm font-semibold mb-3">Asset Allocation</h2>
              <AllocationTreemap data={alloc} onCategorySelect={setActiveCat} />
            </div>
            <div className="bg-surface rounded-xl p-4 border border-border">
              <h2 className="text-sm font-semibold mb-3">Net Worth Trend</h2>
              <NetWorthChart data={history} />
            </div>
          </div>
          <HoldingsAccordion data={alloc} expandedCategory={activeCat} />
        </>
      )}
    </div>
  )
}
