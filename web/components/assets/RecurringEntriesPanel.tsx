'use client'
import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { BASE, fetcher } from '@/lib/api'
import type { RecurringEntry } from '@/lib/types'

export function RecurringEntriesPanel({ assetId, accountId }: { assetId: string; accountId?: string }) {
  const swrKey = `${BASE}/recurring-entries?assetId=${assetId}${accountId ? `&accountId=${accountId}` : ''}`
  const { data: entries, mutate: revalidate } = useSWR<RecurringEntry[]>(swrKey, fetcher)

  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<'income' | 'expense'>('income')
  const [amount, setAmount] = useState('')
  const [currencyCode, setCurrencyCode] = useState('TWD')
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [label, setLabel] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [effectiveTo, setEffectiveTo] = useState('')
  const [saving, setSaving] = useState(false)

  function reset() {
    setType('income'); setAmount(''); setCurrencyCode('TWD')
    setDayOfMonth(1); setLabel(''); setShowAdvanced(false)
    setEffectiveFrom(new Date().toISOString().slice(0, 10)); setEffectiveTo('')
  }

  async function handleCreate() {
    if (!amount || Number(amount) <= 0) return
    setSaving(true)
    await fetch(`${BASE}/recurring-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId, accountId: accountId || undefined,
        type, amount: Number(amount), currencyCode,
        dayOfMonth, label: label || undefined,
        effectiveFrom, effectiveTo: effectiveTo || undefined,
      }),
    })
    setSaving(false); setShowForm(false); reset()
    revalidate(); mutate(`${BASE}/recurring-entries`)
  }

  async function handleDelete(id: string) {
    await fetch(`${BASE}/recurring-entries/${id}`, { method: 'DELETE' })
    revalidate(); mutate(`${BASE}/recurring-entries`)
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="pt-2">
      {/* Section header — same style as HoldingTransactions */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
          自動記
        </p>
        <button
          onClick={() => { setShowForm(!showForm); if (showForm) reset() }}
          className={`text-xs px-2.5 py-1 rounded-full transition-colors
            ${showForm
              ? 'text-[var(--color-muted)]'
              : 'text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10'}`}>
          {showForm ? '取消' : '+ 新增'}
        </button>
      </div>

      {/* ── Form: card style matching the quantity card ── */}
      {showForm && (
        <div className="rounded-xl border border-[var(--color-border)] overflow-hidden mb-3">
          {/* Type toggle */}
          <div className="flex border-b border-[var(--color-border)]">
            {(['income', 'expense'] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors
                  ${type === t
                    ? t === 'income' ? 'bg-green-500 text-white' : 'bg-red-400 text-white'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}>
                {t === 'income' ? '固定收入' : '固定支出'}
              </button>
            ))}
          </div>

          {/* Amount + currency */}
          <div className="flex items-center px-4 py-3.5 border-b border-[var(--color-border)] gap-3">
            <span className="text-sm text-[var(--color-muted)] shrink-0">金額</span>
            <input
              type="number" placeholder="0" value={amount} min="0" autoFocus
              onChange={e => setAmount(e.target.value)}
              className="flex-1 text-right bg-transparent text-xl font-semibold outline-none tabular-nums" />
            <input
              value={currencyCode} maxLength={4}
              onChange={e => setCurrencyCode(e.target.value.toUpperCase())}
              className="w-14 bg-[var(--color-bg)] rounded-lg px-2 py-1 text-xs font-bold text-center outline-none border border-[var(--color-border)]" />
          </div>

          {/* Day of month + label */}
          <div className="flex items-center px-4 py-3.5 border-b border-[var(--color-border)] gap-3">
            <span className="text-sm text-[var(--color-muted)] shrink-0">記錄日期</span>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs text-[var(--color-muted)]">每月</span>
              <input
                type="number" min="1" max="31" value={dayOfMonth}
                onChange={e => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value))))}
                className="w-10 bg-transparent text-sm font-semibold text-center outline-none border-b border-[var(--color-border)]" />
              <span className="text-xs text-[var(--color-muted)]">日</span>
            </div>
          </div>

          {/* Label */}
          <div className="flex items-center px-4 py-3.5 border-b border-[var(--color-border)]">
            <span className="text-sm text-[var(--color-muted)]">標籤</span>
            <input
              placeholder="選填" value={label} onChange={e => setLabel(e.target.value)}
              className="flex-1 text-right bg-transparent text-sm outline-none placeholder:text-[var(--color-border)]" />
          </div>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-4 py-2.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] text-left flex items-center gap-1.5 transition-colors border-b border-[var(--color-border)]">
            <span className={`inline-block transition-transform text-[10px] ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
            有效期限
            {!showAdvanced && <span className="opacity-50 ml-0.5">（預設即日起永遠有效）</span>}
          </button>
          {showAdvanced && (
            <div className="grid grid-cols-2 divide-x divide-[var(--color-border)] border-b border-[var(--color-border)]">
              <div className="px-4 py-3">
                <p className="text-xs text-[var(--color-muted)] mb-1.5">開始</p>
                <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none" />
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-[var(--color-muted)] mb-1.5">結束（空白=永遠）</p>
                <input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none" />
              </div>
            </div>
          )}

          <button
            onClick={handleCreate} disabled={!amount || Number(amount) <= 0 || saving}
            className="w-full py-3 bg-[var(--color-accent)] text-white text-sm font-semibold disabled:opacity-40 transition-opacity">
            {saving ? '儲存中…' : '建立'}
          </button>
        </div>
      )}

      {/* ── Entry list ── */}
      {entries && entries.length > 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
          {entries.map((entry, i) => {
            const isActive = entry.effectiveFrom <= today && (!entry.effectiveTo || entry.effectiveTo >= today)
            return (
              <div key={entry.id}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm
                  ${i < entries.length - 1 ? 'border-b border-[var(--color-border)]' : ''}
                  ${!isActive ? 'opacity-40' : ''}`}>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${entry.type === 'income' ? 'bg-green-500' : 'bg-red-400'}`} />
                <span className={`font-semibold tabular-nums shrink-0 ${entry.type === 'income' ? 'text-green-500' : 'text-red-400'}`}>
                  {entry.type === 'income' ? '+' : '-'}{Number(entry.amount).toLocaleString()} {entry.currencyCode}
                </span>
                <span className="text-xs text-[var(--color-muted)] shrink-0">每月{entry.dayOfMonth}日</span>
                {entry.label && (
                  <span className="text-xs text-[var(--color-muted)] truncate">{entry.label}</span>
                )}
                <button onClick={() => handleDelete(entry.id)}
                  className="ml-auto text-[var(--color-muted)] hover:text-red-400 transition-colors shrink-0 text-base leading-none">
                  ×
                </button>
              </div>
            )
          })}
        </div>
      ) : !showForm ? (
        <p className="text-xs text-[var(--color-muted)] text-center py-3">尚無定期現金流</p>
      ) : null}
    </div>
  )
}
