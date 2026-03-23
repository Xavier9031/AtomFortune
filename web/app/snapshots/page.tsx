'use client'
import useSWR from 'swr'
import { BASE, fetcher } from '@/lib/api'
import { SnapshotsList } from '@/components/snapshots/SnapshotsList'

export default function SnapshotsPage() {
  const { data, mutate } = useSWR<{ snapshotDate: string; netWorth: number }[]>(
    `${BASE}/snapshots/history?range=all`, fetcher)
  const dates = (data ?? []).map(d => d.snapshotDate).sort().reverse()

  async function handleRebuild(date: string) {
    await fetch(`${BASE}/snapshots/rebuild/${date}`, { method: 'POST' })
    mutate()
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-6">快照歷史</h1>
      <SnapshotsList dates={dates} onRebuild={handleRebuild} onExpand={() => {}} />
    </main>
  )
}
