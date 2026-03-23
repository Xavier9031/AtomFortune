'use client'
import { useState } from 'react'
import { useCurrency } from '@/context/CurrencyContext'
import { useLiveDashboard, useNetWorthHistory, BASE } from '@/lib/api'
import NetWorthHeader from '@/components/dashboard/NetWorthHeader'
import AllocationBreakdown from '@/components/dashboard/AllocationBreakdown'
import NetWorthChart from '@/components/dashboard/NetWorthChart'
import type { DashboardSummary } from '@/lib/types'

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
  const { data: live, isLoading: liveLoading } = useLiveDashboard(currency)
  const { data: history } = useNetWorthHistory(currency)

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
          <h2 className="text-xl font-bold">尚無資料</h2>
          <p className="text-sm text-[var(--color-muted)] max-w-sm">
            完成以下步驟後，儀表板將自動顯示你的淨值概覽。
          </p>
        </div>
        <ol className="text-left space-y-3 text-sm">
          <li className="flex gap-3 items-start">
            <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center text-xs font-bold">1</span>
            <div>
              <a href="/accounts" className="font-medium text-[var(--color-accent)] hover:underline">前往「帳戶管理」</a>
              <span className="text-[var(--color-muted)]"> 新增你的帳戶（銀行、券商、錢包等）</span>
            </div>
          </li>
          <li className="flex gap-3 items-start">
            <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center text-xs font-bold">2</span>
            <div>
              <a href="/holdings" className="font-medium text-[var(--color-accent)] hover:underline">前往「持倉管理」</a>
              <span className="text-[var(--color-muted)]"> 新增持倉並設定餘額或數量</span>
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
    missingAssets: [],
  }

  return (
    <div data-testid="dashboard-root">
      <NetWorthHeader summary={liveSummary} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
          <h2 className="text-sm font-semibold mb-3">資產配置</h2>
          <AllocationBreakdown
            categories={live.categories}
            totalAssets={live.totalAssets}
            totalLiabilities={live.totalLiabilities}
            displayCurrency={live.displayCurrency}
          />
        </div>
        <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
          <h2 className="text-sm font-semibold mb-3">淨值歷史</h2>
          {history && history.data.length > 0
            ? <NetWorthChart data={history} />
            : <div className="flex items-center justify-center h-40 text-sm text-[var(--color-muted)] flex-col gap-2">
                <p>尚無歷史快照</p>
                <TriggerSnapshotButton />
              </div>
          }
        </div>
      </div>
    </div>
  )
}
