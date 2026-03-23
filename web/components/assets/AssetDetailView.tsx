'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Settings } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { BASE, fetcher } from '@/lib/api'
import { formatValue, getHoldingUnit } from '@/lib/utils'
import { ManualPriceModal } from './ManualPriceModal'
import type { Asset, Holding, Transaction } from '@/lib/types'

type ChartRange = '30d' | '1y' | 'all'
interface SnapshotPoint { snapshotDate: string; valueInBase: number }

const SUB_KIND_LABELS: Record<string, string> = {
  bank_account: '銀行存款', physical_cash: '現金', e_wallet: '電子錢包',
  stablecoin: '穩定幣', stock: '股票', etf: 'ETF', fund: '基金',
  crypto: '加密貨幣', precious_metal: '實體貴金屬', real_estate: '不動產',
  vehicle: '車輛', receivable: '應收款', credit_card: '信用卡',
  mortgage: '房貸', personal_loan: '個人貸款', other: '其他',
}
const PRICING_LABELS: Record<string, string> = { market: '市價', fixed: '固定', manual: '手動' }

export function AssetDetailView({ asset: initial }: { asset: Asset }) {
  const router = useRouter()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initial.name)
  const [symbol, setSymbol] = useState(initial.symbol ?? '')
  const [saving, setSaving] = useState(false)
  const [range, setRange] = useState<ChartRange>('30d')
  const [priceModalOpen, setPriceModalOpen] = useState(false)

  const { data: allHoldings } = useSWR<Holding[]>(`${BASE}/holdings`, fetcher)
  const { data: snapshots } = useSWR<SnapshotPoint[]>(
    `${BASE}/snapshots/items?assetId=${initial.id}&range=${range}`, fetcher)
  const { data: txns } = useSWR<Transaction[]>(
    `${BASE}/transactions?assetId=${initial.id}`, fetcher)

  const holdings = (allHoldings ?? []).filter(h => h.assetId === initial.id)
  const totalQty = holdings.reduce((s, h) => s + Number(h.quantity), 0)
  const totalValue = holdings.reduce((s, h) => s + (Number(h.latestValueInBase) || 0), 0)
  const chartData = (snapshots ?? []).map(d => ({ date: d.snapshotDate, value: Number(d.valueInBase) }))
  const sortedTxns = [...(txns ?? [])].sort((a, b) => b.txnDate.localeCompare(a.txnDate))
  const unit = initial.unit ?? initial.symbol ?? initial.currencyCode

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

  function closeSettings() {
    setSettingsOpen(false)
    setEditing(false)
    setName(initial.name)
    setSymbol(initial.symbol ?? '')
  }

  return (
    <div className="space-y-5">

      {/* ── Hero card ── */}
      <section className="rounded-xl border border-[var(--color-border)] p-5 relative">
        <button
          onClick={() => settingsOpen ? closeSettings() : setSettingsOpen(true)}
          title="資產設定"
          className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors
            ${settingsOpen
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]'}`}>
          <Settings size={15} />
        </button>

        {/* Labels row */}
        <div className="flex items-center gap-2 mb-4 pr-10">
          {initial.symbol && (
            <span className="px-2.5 py-0.5 bg-[var(--color-text)] text-[var(--color-surface)] rounded-full text-xs font-bold">
              {initial.symbol}
            </span>
          )}
          <span className="text-xs text-[var(--color-muted)]">
            {SUB_KIND_LABELS[initial.subKind] ?? initial.subKind}
          </span>
          <span className="text-xs text-[var(--color-border)]">·</span>
          <span className="text-xs text-[var(--color-muted)]">
            {PRICING_LABELS[initial.pricingMode] ?? initial.pricingMode}
          </span>
        </div>

        {/* Total quantity */}
        <div className="text-3xl font-bold tabular-nums">
          {totalQty.toLocaleString('zh-TW', { maximumFractionDigits: 8 })}
          <span className="text-base font-normal text-[var(--color-muted)] ml-2">{unit}</span>
        </div>

        {/* Estimated TWD value */}
        {totalValue > 0 && (
          <p className="text-sm text-[var(--color-muted)] mt-1.5">
            ≈ {formatValue(totalValue, 'TWD')}
          </p>
        )}
      </section>

      {/* ── Settings accordion ── */}
      {settingsOpen && (
        <section className="rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div className="grid grid-cols-[6rem_1fr] items-center px-4 py-3 border-b border-[var(--color-border)]">
            <span className="text-sm text-[var(--color-muted)]">名稱</span>
            {editing
              ? <input value={name} onChange={e => setName(e.target.value)} autoFocus
                  className="text-right bg-transparent text-sm outline-none border-b border-[var(--color-accent)] w-full" />
              : <span className="text-right text-sm font-medium">{initial.name}</span>}
          </div>
          {(initial.pricingMode === 'market' || initial.symbol) && (
            <div className="grid grid-cols-[6rem_1fr] items-center px-4 py-3 border-b border-[var(--color-border)]">
              <span className="text-sm text-[var(--color-muted)]">代號</span>
              {editing
                ? <input value={symbol} onChange={e => setSymbol(e.target.value)}
                    placeholder="例：0050.TW"
                    className="text-right bg-transparent text-sm outline-none border-b border-[var(--color-accent)] w-full" />
                : <span className="text-right text-sm">{initial.symbol ?? '—'}</span>}
            </div>
          )}
          {[
            { label: '幣別', value: initial.currencyCode },
            { label: '類型', value: SUB_KIND_LABELS[initial.subKind] ?? initial.subKind },
            { label: '報價', value: PRICING_LABELS[initial.pricingMode] ?? initial.pricingMode },
          ].map(({ label, value }) => (
            <div key={label} className="grid grid-cols-[6rem_1fr] items-center px-4 py-3 border-b border-[var(--color-border)]">
              <span className="text-sm text-[var(--color-muted)]">{label}</span>
              <span className="text-right text-sm">{value}</span>
            </div>
          ))}
          <div className="flex gap-2 px-4 py-3">
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
                編輯名稱 / 代號
              </button>
            )}
          </div>
          {initial.pricingMode === 'manual' && (
            <div className="px-4 pb-3 border-t border-[var(--color-border)] pt-3">
              <button onClick={() => setPriceModalOpen(true)}
                className="w-full border border-[var(--color-border)] rounded-lg py-2 text-sm
                  hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors">
                更新今日價格
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── Account distribution ── */}
      <section>
        <h2 className="text-sm font-semibold mb-3">持倉分布</h2>
        {holdings.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">尚無持倉</p>
        ) : (
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
            {holdings.map((h, i) => {
              // Within a single asset, all holdings share the same unit price,
              // so quantity proportion == value proportion
              const qty = Number(h.quantity)
              const pct = totalQty > 0 ? (qty / totalQty) * 100 : 0
              return (
                <div key={`${h.assetId}-${h.accountId}`}
                  className={`px-4 py-3 ${i < holdings.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium">
                      {h.accountName}
                      {h.institution && (
                        <span className="text-[var(--color-muted)] font-normal"> · {h.institution}</span>
                      )}
                    </span>
                    <div className="text-right tabular-nums">
                      <span className="font-medium">
                        {qty.toLocaleString('zh-TW', { maximumFractionDigits: 8 })}
                      </span>
                      <span className="text-xs text-[var(--color-muted)] ml-1">{getHoldingUnit(h)}</span>
                      <span className="text-xs text-[var(--color-muted)] ml-2">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${pct.toFixed(1)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Value trend chart ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">價值趨勢</h2>
          <div className="flex gap-1 p-0.5 bg-[var(--color-bg)] rounded-lg">
            {(['30d', '1y', 'all'] as ChartRange[]).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors
                  ${range === r
                    ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                    : 'text-[var(--color-muted)]'}`}>
                {r === '30d' ? '30天' : r === '1y' ? '1年' : '全部'}
              </button>
            ))}
          </div>
        </div>
        {chartData.length > 0 ? (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                  tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted)' }} width={75}
                  tickFormatter={v => formatValue(Number(v), 'TWD')} />
                <Tooltip
                  formatter={(v: unknown) => [formatValue(Number(v ?? 0), 'TWD'), '估值']}
                  labelStyle={{ color: 'var(--color-muted)', fontSize: 12 }}
                  contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }} />
                <Line type="monotone" dataKey="value" stroke="var(--color-accent)"
                  strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-muted)] py-8 text-center">尚無歷史資料</p>
        )}
      </section>

      {/* ── Transaction history ── */}
      <section>
        <h2 className="text-sm font-semibold mb-3">交易紀錄</h2>
        {sortedTxns.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">尚無交易紀錄</p>
        ) : (
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
            {sortedTxns.map((t, i) => {
              const isPositive = t.txnType === 'buy' || t.txnType === 'transfer_in'
              const isNeutral = t.txnType === 'adjustment'
              return (
                <div key={t.id}
                  className={`flex items-center justify-between pl-3 pr-4 py-3 text-sm border-l-2
                    ${isNeutral ? 'border-l-yellow-400' : isPositive ? 'border-l-green-500' : 'border-l-red-500'}
                    ${i < sortedTxns.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}>
                  <div>
                    <span className="text-[var(--color-muted)] text-xs">{t.txnDate}</span>
                    {t.note && <p className="text-xs text-[var(--color-muted)] mt-0.5">{t.note}</p>}
                  </div>
                  <span className={`font-medium tabular-nums
                    ${isNeutral ? 'text-yellow-400' : isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {isNeutral ? '±' : isPositive ? '+' : '−'}
                    {Number(t.quantity).toLocaleString('zh-TW', { maximumFractionDigits: 8 })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <ManualPriceModal assetId={initial.id} open={priceModalOpen}
        onClose={() => setPriceModalOpen(false)} />
    </div>
  )
}
