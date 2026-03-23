'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { BASE, fetcher } from '@/lib/api'
import { ManualPriceModal } from './ManualPriceModal'
import type { Asset, Transaction } from '@/lib/types'

interface SnapshotPoint { snapshotDate: string; valueInBase: number }

export function AssetDetailView({ asset: initial }: { asset: Asset }) {
  const router = useRouter()
  const { data: assetHistory } = useSWR<SnapshotPoint[]>(
    `${BASE}/snapshots/items?assetId=${initial.id}&range=30d`, fetcher)
  const { data: txns } = useSWR<Transaction[]>(
    `${BASE}/transactions?assetId=${initial.id}`, fetcher)
  const [priceModalOpen, setPriceModalOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initial.name)
  const [symbol, setSymbol] = useState(initial.symbol ?? '')
  const [saving, setSaving] = useState(false)

  const chartData = (assetHistory ?? []).map(d => ({ date: d.snapshotDate, value: d.valueInBase }))

  async function handleSave() {
    setSaving(true)
    await fetch(`${BASE}/assets/${initial.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), symbol: symbol.trim() || undefined }),
    })
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  return (
    <div className="space-y-8">
      {/* Info card */}
      <section className="rounded-xl border border-[var(--color-border)] overflow-hidden">
        {/* Editable fields */}
        <div className="grid grid-cols-[6rem_1fr] items-center px-4 py-3.5 border-b border-[var(--color-border)]">
          <span className="text-sm text-[var(--color-muted)]">名稱</span>
          {editing
            ? <input value={name} onChange={e => setName(e.target.value)} autoFocus
                className="text-right bg-transparent text-sm outline-none border-b border-[var(--color-accent)] w-full" />
            : <span className="text-right text-sm font-medium">{initial.name}</span>}
        </div>
        {(initial.pricingMode === 'market' || initial.symbol) && (
          <div className="grid grid-cols-[6rem_1fr] items-center px-4 py-3.5 border-b border-[var(--color-border)]">
            <span className="text-sm text-[var(--color-muted)]">代號</span>
            {editing
              ? <input value={symbol} onChange={e => setSymbol(e.target.value)}
                  placeholder="例：2330.TW"
                  className="text-right bg-transparent text-sm outline-none border-b border-[var(--color-accent)] w-full" />
              : <span className="text-right text-sm">{initial.symbol ?? '—'}</span>}
          </div>
        )}
        {/* Read-only fields */}
        {[
          { label: '幣別', value: initial.currencyCode },
          { label: '類型', value: initial.subKind },
          { label: '報價', value: initial.pricingMode },
        ].map(({ label, value }) => (
          <div key={label} className="grid grid-cols-[6rem_1fr] items-center px-4 py-3.5 border-b border-[var(--color-border)] last:border-0">
            <span className="text-sm text-[var(--color-muted)]">{label}</span>
            <span className="text-right text-sm">{value}</span>
          </div>
        ))}

        {/* Edit / Save buttons */}
        <div className="flex gap-2 px-4 py-3 border-t border-[var(--color-border)]">
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setName(initial.name); setSymbol(initial.symbol ?? '') }}
                className="flex-1 border border-[var(--color-border)] rounded-lg py-2 text-sm">
                取消
              </button>
              <button onClick={handleSave} disabled={!name.trim() || saving}
                className="flex-1 bg-[var(--color-accent)] text-white rounded-lg py-2 text-sm disabled:opacity-40">
                {saving ? '儲存中…' : '儲存'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}
              className="flex-1 border border-[var(--color-border)] rounded-lg py-2 text-sm
                hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors">
              編輯
            </button>
          )}
        </div>
      </section>

      {/* Chart */}
      {chartData.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3 text-sm">價值趨勢</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} width={60} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="var(--color-accent)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Transactions */}
      <section>
        <h2 className="font-semibold mb-3 text-sm">交易紀錄</h2>
        {(txns ?? []).length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">尚無交易紀錄</p>
        ) : (
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
            {[...(txns ?? [])].sort((a, b) => b.txnDate.localeCompare(a.txnDate)).map((t, i, arr) => {
              const isPositive = t.txnType === 'buy' || t.txnType === 'transfer_in'
              return (
                <div key={t.id}
                  className={`flex items-center justify-between pl-3 pr-4 py-3 text-sm border-l-2
                    ${isPositive ? 'border-l-green-500' : 'border-l-red-500'}
                    ${i < arr.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}>
                  <div>
                    <span className="text-[var(--color-muted)] text-xs">{t.txnDate}</span>
                    {t.note && <p className="text-xs text-[var(--color-muted)] mt-0.5">{t.note}</p>}
                  </div>
                  <span className={`font-medium tabular-nums ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {isPositive ? '+' : '−'}
                    {Number(t.quantity).toLocaleString('zh-TW', { maximumFractionDigits: 8 })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {initial.pricingMode === 'manual' && (
        <button onClick={() => setPriceModalOpen(true)}
          className="w-full bg-[var(--color-accent)] text-white rounded-xl py-3 font-medium">
          更新今日價格
        </button>
      )}
      <ManualPriceModal assetId={initial.id} open={priceModalOpen}
        onClose={() => setPriceModalOpen(false)} />
    </div>
  )
}
