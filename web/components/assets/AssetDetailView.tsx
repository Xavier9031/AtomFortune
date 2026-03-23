'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { BASE, fetcher } from '@/lib/api'
import { ManualPriceModal } from './ManualPriceModal'
import type { Asset, Transaction } from '@/lib/types'

interface SnapshotPoint { snapshotDate: string; valueInBase: number }

export function AssetDetailView({ asset }: { asset: Asset }) {
  const { data: assetHistory } = useSWR<SnapshotPoint[]>(
    `${BASE}/snapshots/items?assetId=${asset.id}&range=30d`, fetcher)
  const { data: txns } = useSWR<Transaction[]>(
    `${BASE}/transactions?assetId=${asset.id}`, fetcher)
  const [priceModalOpen, setPriceModalOpen] = useState(false)

  const chartData = (assetHistory ?? []).map(d => ({ date: d.snapshotDate, value: d.valueInBase }))

  return (
    <div className="space-y-8">
      <section className="rounded-lg border p-4 grid grid-cols-2 gap-2 text-sm">
        <div><span className="text-[var(--color-muted)]">名稱</span><p className="font-medium">{asset.name}</p></div>
        <div><span className="text-[var(--color-muted)]">類別</span><p>{asset.assetClass}</p></div>
        <div><span className="text-[var(--color-muted)]">Category</span><p>{asset.category}</p></div>
        <div><span className="text-[var(--color-muted)]">Sub-kind</span><p>{asset.subKind}</p></div>
        <div><span className="text-[var(--color-muted)]">Symbol</span><p>{asset.symbol ?? '—'}</p></div>
        <div><span className="text-[var(--color-muted)]">幣別</span><p>{asset.currencyCode}</p></div>
        <div><span className="text-[var(--color-muted)]">報價</span><p>{asset.pricingMode}</p></div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">價值趨勢</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="var(--color-accent)" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h2 className="font-semibold mb-2">交易紀錄</h2>
        <div className="space-y-2">
          {(txns ?? []).map(t => (
            <div key={t.id} className="flex justify-between text-sm border-b py-2">
              <span>{t.txnDate} — {t.txnType}</span>
              <span>{t.quantity}</span>
            </div>
          ))}
        </div>
      </section>

      {asset.pricingMode === 'manual' && (
        <button onClick={() => setPriceModalOpen(true)}
          className="bg-[var(--color-accent)] text-white px-4 py-2 rounded">更新今日價格</button>
      )}
      <ManualPriceModal assetId={asset.id} open={priceModalOpen}
        onClose={() => setPriceModalOpen(false)} />
    </div>
  )
}
