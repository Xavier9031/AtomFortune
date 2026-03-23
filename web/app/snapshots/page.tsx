'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import { RefreshCw, CheckCircle, XCircle, Database } from 'lucide-react'
import { BASE, fetcher } from '@/lib/api'
import { SnapshotsList } from '@/components/snapshots/SnapshotsList'

type PriceResult = { assetId: string; name: string; symbol: string; price: number | null; status: 'ok' | 'failed' }
type TriggerResult = { date: string; prices: PriceResult[]; fxStatus: 'ok' | 'failed'; snapshotItemsWritten: number }

export default function SnapshotsPage() {
  const t = useTranslations()
  const { data, mutate } = useSWR<{ snapshotDate: string; netWorth: number }[]>(
    `${BASE}/snapshots/history?range=all`, fetcher)
  const dates = (data ?? []).map(d => d.snapshotDate).sort().reverse()

  const [triggering, setTriggering] = useState(false)
  const [result, setResult] = useState<TriggerResult | null>(null)
  const [triggerError, setTriggerError] = useState<string | null>(null)

  async function handleTriggerToday() {
    setTriggering(true)
    setResult(null)
    setTriggerError(null)
    try {
      const res = await fetch(`${BASE}/snapshots/trigger`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setTriggerError(json.error ?? `HTTP ${res.status}`)
      } else {
        setResult(json as TriggerResult)
        await mutate()
      }
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : String(err))
    } finally {
      setTriggering(false)
    }
  }

  async function handleRebuild(date: string) {
    await fetch(`${BASE}/snapshots/rebuild/${date}`, { method: 'POST' })
    mutate()
  }

  const okCount = result?.prices.filter(p => p.status === 'ok').length ?? 0
  const failCount = result?.prices.filter(p => p.status === 'failed').length ?? 0

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header + trigger button */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('snapshots.title')}</h1>
        <button onClick={handleTriggerToday} disabled={triggering}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white
            text-sm font-medium disabled:opacity-50 transition-opacity">
          <RefreshCw size={14} className={triggering ? 'animate-spin' : ''} />
          {triggering ? t('snapshots.fetchingPrices') : t('snapshots.triggerMarketPrices')}
        </button>
      </div>

      {/* Error panel */}
      {triggerError && (
        <div className="rounded-xl border border-red-400 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {triggerError}
        </div>
      )}

      {/* Result panel */}
      {result && (
        <div className="rounded-xl border border-[var(--color-border)] overflow-hidden text-sm">
          {/* Summary header */}
          <div className="px-4 py-3 bg-[var(--color-bg)] flex items-center justify-between">
            <span className="font-semibold">{t('snapshots.updateResult', { date: result.date })}</span>
            <div className="flex items-center gap-3 text-xs text-[var(--color-muted)]">
              <span className="flex items-center gap-1 text-green-500">
                <CheckCircle size={12} /> {okCount} {t('snapshots.priceOk')}
              </span>
              {failCount > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <XCircle size={12} /> {failCount} {t('snapshots.priceFailed')}
                </span>
              )}
              <span className={`flex items-center gap-1 ${result.fxStatus === 'ok' ? 'text-green-500' : 'text-red-400'}`}>
                {result.fxStatus === 'ok' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                {t('snapshots.fxRate')}
              </span>
              <span className="flex items-center gap-1">
                <Database size={12} />
                {t('snapshots.snapshotItems', { count: result.snapshotItemsWritten })}
              </span>
            </div>
          </div>

          {/* Per-asset rows */}
          {result.prices.map((p, i) => (
            <div key={p.assetId}
              className={`flex items-center justify-between px-4 py-2.5
                ${i < result.prices.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}>
              <div className="flex items-center gap-2">
                {p.status === 'ok'
                  ? <CheckCircle size={14} className="text-green-500 shrink-0" />
                  : <XCircle size={14} className="text-red-400 shrink-0" />}
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-[var(--color-muted)]">{p.symbol}</span>
              </div>
              <span className={p.status === 'ok' ? 'font-mono text-xs' : 'text-xs text-[var(--color-muted)]'}>
                {p.price != null
                  ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(p.price)
                  : t('snapshots.priceFetchFailed')}
              </span>
            </div>
          ))}
        </div>
      )}

      <SnapshotsList dates={dates} onRebuild={handleRebuild} onExpand={() => {}} />
    </main>
  )
}
