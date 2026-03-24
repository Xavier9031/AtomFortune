'use client'
import { useState } from 'react'
import { mutate } from 'swr'
import { BASE, fetcher, useRecurringEntries } from '@/lib/api'
import type { RecurringEntry } from '@/lib/types'

function fmt(amount: string, type: 'income' | 'expense') {
  const n = Number(amount)
  return `${type === 'income' ? '+' : '-'}${n.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}`
}

export function RecurringEntriesPanel({ assetId }: { assetId: string }) {
  const { data: entries, mutate: revalidate } = useRecurringEntries(assetId)
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<'income' | 'expense'>('income')
  const [amount, setAmount] = useState('')
  const [currencyCode, setCurrencyCode] = useState('TWD')
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [label, setLabel] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [effectiveTo, setEffectiveTo] = useState('')
  const [saving, setSaving] = useState(false)

  function resetForm() {
    setType('income'); setAmount(''); setCurrencyCode('TWD')
    setDayOfMonth(1); setLabel('')
    setEffectiveFrom(new Date().toISOString().slice(0, 10)); setEffectiveTo('')
  }

  async function handleCreate() {
    if (!amount || Number(amount) <= 0) return
    setSaving(true)
    await fetch(`${BASE}/recurring-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId, type, amount: Number(amount), currencyCode,
        dayOfMonth, label: label || undefined,
        effectiveFrom, effectiveTo: effectiveTo || undefined,
      }),
    })
    setSaving(false)
    setShowForm(false)
    resetForm()
    revalidate()
    // also refresh the global list (used by FIRE widget)
    mutate(`${BASE}/recurring-entries`)
  }

  async function handleDelete(id: string) {
    await fetch(`${BASE}/recurring-entries/${id}`, { method: 'DELETE' })
    revalidate()
    mutate(`${BASE}/recurring-entries`)
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">自動記（定期現金流）</h2>
        <button onClick={() => { setShowForm(!showForm); if (showForm) resetForm() }}
          className="text-xs text-[var(--color-accent)] hover:underline">
          {showForm ? '取消' : '+ 新增'}
        </button>
      </div>

      {/* ── Create form ── */}
      {showForm && (
        <div className="rounded-xl border border-[var(--color-border)] p-4 mb-3 space-y-3">
          {/* Type toggle */}
          <div className="flex gap-2">
            {(['income', 'expense'] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 py-2 text-xs rounded-lg border transition-colors font-medium
                  ${type === t
                    ? t === 'income' ? 'bg-green-500 text-white border-green-500' : 'bg-red-400 text-white border-red-400'
                    : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-text)]'}`}>
                {t === 'income' ? '固定收入' : '固定支出'}
              </button>
            ))}
          </div>

          {/* Amount + Currency */}
          <div className="flex gap-2">
            <input type="number" placeholder="金額" value={amount}
              onChange={e => setAmount(e.target.value)} min="0"
              className="flex-1 bg-transparent border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]" />
            <input value={currencyCode} onChange={e => setCurrencyCode(e.target.value.toUpperCase())}
              maxLength={4}
              className="w-16 bg-transparent border border-[var(--color-border)] rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:border-[var(--color-accent)]" />
          </div>

          {/* Day of month */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--color-muted)] text-xs shrink-0">記錄日期</span>
            <span className="text-xs text-[var(--color-muted)]">每月</span>
            <input type="number" min="1" max="31" value={dayOfMonth}
              onChange={e => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value))))}
              className="w-14 bg-transparent border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-[var(--color-accent)]" />
            <span className="text-xs text-[var(--color-muted)]">日</span>
          </div>

          {/* Label */}
          <input placeholder="標籤（選填）" value={label} onChange={e => setLabel(e.target.value)}
            className="w-full bg-transparent border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]" />

          {/* Effective dates */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-[var(--color-muted)]">開始日期</label>
              <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)}
                className="w-full bg-transparent border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-[var(--color-accent)]" />
            </div>
            <div>
              <label className="text-xs text-[var(--color-muted)]">有效期限（空白為永遠）</label>
              <input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)}
                className="w-full bg-transparent border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-[var(--color-accent)]" />
            </div>
          </div>

          <button onClick={handleCreate} disabled={!amount || Number(amount) <= 0 || saving}
            className="w-full bg-[var(--color-accent)] text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 transition-opacity">
            {saving ? '儲存中…' : '建立'}
          </button>
        </div>
      )}

      {/* ── Entry list ── */}
      {!entries?.length && !showForm && (
        <p className="text-sm text-[var(--color-muted)]">尚無定期現金流記錄</p>
      )}
      {entries && entries.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
          {entries.map((entry, i) => {
            const isActive = entry.effectiveFrom <= today && (!entry.effectiveTo || entry.effectiveTo >= today)
            return (
              <div key={entry.id}
                className={`flex items-start justify-between px-4 py-3 text-sm
                  ${i < entries.length - 1 ? 'border-b border-[var(--color-border)]' : ''}
                  ${!isActive ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-2.5">
                  <span className={`mt-0.5 text-xs px-2 py-0.5 rounded-full shrink-0
                    ${entry.type === 'income' ? 'bg-green-500/10 text-green-500' : 'bg-red-400/10 text-red-400'}`}>
                    {entry.type === 'income' ? '收入' : '支出'}
                  </span>
                  <div>
                    <div className="font-medium tabular-nums">
                      <span className={entry.type === 'income' ? 'text-green-500' : 'text-red-400'}>
                        {fmt(entry.amount, entry.type)}
                      </span>
                      <span className="text-[var(--color-muted)] font-normal text-xs ml-1">{entry.currencyCode}</span>
                      <span className="text-[var(--color-muted)] font-normal text-xs ml-2">每月 {entry.dayOfMonth} 日</span>
                    </div>
                    {entry.label && <div className="text-xs text-[var(--color-muted)] mt-0.5">{entry.label}</div>}
                    <div className="text-xs text-[var(--color-muted)] mt-0.5">
                      {entry.effectiveFrom} → {entry.effectiveTo ?? '永遠'}
                      {!isActive && <span className="ml-2 text-yellow-500">（已失效）</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => handleDelete(entry.id)}
                  className="text-[var(--color-muted)] hover:text-red-400 transition-colors text-xs ml-3 shrink-0 mt-0.5">
                  刪除
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
