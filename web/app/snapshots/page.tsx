'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { RefreshCw } from 'lucide-react'
import { BASE, fetcher } from '@/lib/api'
import { SnapshotsList } from '@/components/snapshots/SnapshotsList'

export default function SnapshotsPage() {
  const { data, mutate } = useSWR<{ snapshotDate: string; netWorth: number }[]>(
    `${BASE}/snapshots/history?range=all`, fetcher)
  const dates = (data ?? []).map(d => d.snapshotDate).sort().reverse()
  const [triggering, setTriggering] = useState(false)

  async function handleRebuild(date: string) {
    await fetch(`${BASE}/snapshots/rebuild/${date}`, { method: 'POST' })
    mutate()
  }

  async function handleTriggerToday() {
    setTriggering(true)
    try {
      await fetch(`${BASE}/snapshots/trigger`, { method: 'POST' })
      await mutate()
    } finally {
      setTriggering(false)
    }
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">快照歷史</h1>
        <button onClick={handleTriggerToday} disabled={triggering}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white
            text-sm font-medium disabled:opacity-50 transition-opacity">
          <RefreshCw size={14} className={triggering ? 'animate-spin' : ''} />
          {triggering ? '更新中…' : '更新今日市場價格'}
        </button>
      </div>
      <SnapshotsList dates={dates} onRebuild={handleRebuild} onExpand={() => {}} />
    </main>
  )
}
