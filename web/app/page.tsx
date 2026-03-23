'use client'
import { useState } from 'react'
import { useCurrency } from '@/context/CurrencyContext'
import { useDashboardSummary, useAllocation, useNetWorthHistory, BASE } from '@/lib/api'
import NetWorthHeader from '@/components/dashboard/NetWorthHeader'
import AllocationTreemap from '@/components/dashboard/AllocationTreemap'
import NetWorthChart from '@/components/dashboard/NetWorthChart'
import HoldingsAccordion from '@/components/dashboard/HoldingsAccordion'
import type { Category } from '@/lib/types'

function TriggerSnapshotButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  async function trigger() {
    setStatus('loading')
    try {
      await fetch(`${BASE.replace('/api/v1', '')}/snapshots/trigger`, { method: 'POST' })
      setStatus('done')
      setTimeout(() => window.location.reload(), 1000)
    } catch {
      setStatus('error')
    }
  }
  return (
    <button onClick={trigger} disabled={status === 'loading' || status === 'done'}
      className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-lg disabled:opacity-60">
      {status === 'idle' && '執行今日快照'}
      {status === 'loading' && '執行中…'}
      {status === 'done' && '完成！重新整理中…'}
      {status === 'error' && '失敗，請稍後再試'}
    </button>
  )
}

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
      {!isLoading && !summary && (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
          <div className="text-5xl">📊</div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">尚無快照資料</h2>
            <p className="text-sm text-[var(--color-muted)] max-w-sm">
              完成以下步驟後，儀表板將自動顯示你的淨值概覽。
            </p>
          </div>
          <ol className="text-left space-y-3 text-sm">
            <li className="flex gap-3 items-start">
              <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <a href="/assets" className="font-medium text-[var(--color-accent)] hover:underline">前往「資產設定」</a>
                <span className="text-[var(--color-muted)]"> 新增你的資產（股票、房產、銀行帳戶等）</span>
              </div>
            </li>
            <li className="flex gap-3 items-start">
              <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <a href="/accounts" className="font-medium text-[var(--color-accent)] hover:underline">前往「帳戶管理」</a>
                <span className="text-[var(--color-muted)]"> 新增你的帳戶（券商、銀行、錢包等）</span>
              </div>
            </li>
            <li className="flex gap-3 items-start">
              <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <a href="/holdings" className="font-medium text-[var(--color-accent)] hover:underline">前往「持倉管理」</a>
                <span className="text-[var(--color-muted)]"> 新增每個帳戶持有的資產與數量</span>
              </div>
            </li>
            <li className="flex gap-3 items-start">
              <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center text-xs font-bold">4</span>
              <div>
                <span className="font-medium">執行今日快照</span>
                <span className="text-[var(--color-muted)]"> 點擊下方按鈕觸發第一筆快照</span>
              </div>
            </li>
          </ol>
          <TriggerSnapshotButton />
        </div>
      )}
    </div>
  )
}
