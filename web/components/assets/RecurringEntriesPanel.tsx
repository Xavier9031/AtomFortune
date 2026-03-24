'use client'
import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { BASE, fetcher } from '@/lib/api'
import type { RecurringEntry } from '@/lib/types'

// ── Month/Year picker — replaces native <input type="date"> ────────────────────

const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

function toYYYYMMDD(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}-01`
}
function parseYM(dateStr: string): { year: number; month: number } {
  if (!dateStr) return { year: new Date().getFullYear(), month: new Date().getMonth() + 1 }
  const [y, m] = dateStr.split('-').map(Number)
  return { year: y, month: m }
}

function MonthYearPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { year, month } = parseYM(value)
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 12 }, (_, i) => thisYear - 1 + i)

  const selectClass = `bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg
    px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-accent)] appearance-none
    cursor-pointer text-[var(--color-text)]`

  return (
    <div className="flex gap-2">
      <select value={year} onChange={e => onChange(toYYYYMMDD(Number(e.target.value), month))}
        className={`w-20 ${selectClass}`}>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <select value={month} onChange={e => onChange(toYYYYMMDD(year, Number(e.target.value)))}
        className={`flex-1 ${selectClass}`}>
        {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
      </select>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

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
  const [hasEndDate, setHasEndDate] = useState(false)
  const [effectiveTo, setEffectiveTo] = useState('')
  const [saving, setSaving] = useState(false)

  function reset() {
    setType('income'); setAmount(''); setCurrencyCode('TWD')
    setDayOfMonth(1); setLabel(''); setShowAdvanced(false)
    setEffectiveFrom(new Date().toISOString().slice(0, 10))
    setHasEndDate(false); setEffectiveTo('')
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
        effectiveFrom,
        effectiveTo: hasEndDate && effectiveTo ? effectiveTo : undefined,
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
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">自動記</p>
        <button
          onClick={() => { setShowForm(!showForm); if (showForm) reset() }}
          className={`text-xs px-2.5 py-1 rounded-full transition-colors
            ${showForm ? 'text-[var(--color-muted)]' : 'text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10'}`}>
          {showForm ? '取消' : '+ 新增'}
        </button>
      </div>

      {/* ── Form ── */}
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
            <input type="number" placeholder="0" value={amount} min="0" autoFocus
              onChange={e => setAmount(e.target.value)}
              className="flex-1 text-right bg-transparent text-xl font-semibold outline-none tabular-nums" />
            <input value={currencyCode} maxLength={4}
              onChange={e => setCurrencyCode(e.target.value.toUpperCase())}
              className="w-14 bg-[var(--color-bg)] rounded-lg px-2 py-1 text-xs font-bold text-center outline-none border border-[var(--color-border)]" />
          </div>

          {/* Day of month */}
          <div className="flex items-center px-4 py-3.5 border-b border-[var(--color-border)] gap-3">
            <span className="text-sm text-[var(--color-muted)] shrink-0">記錄日期</span>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs text-[var(--color-muted)]">每月</span>
              <input type="number" min="1" max="31" value={dayOfMonth}
                onChange={e => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value))))}
                className="w-10 bg-transparent text-sm font-semibold text-center outline-none border-b border-[var(--color-border)]" />
              <span className="text-xs text-[var(--color-muted)]">日</span>
            </div>
          </div>

          {/* Label */}
          <div className="flex items-center px-4 py-3.5 border-b border-[var(--color-border)]">
            <span className="text-sm text-[var(--color-muted)]">標籤</span>
            <input placeholder="選填" value={label} onChange={e => setLabel(e.target.value)}
              className="flex-1 text-right bg-transparent text-sm outline-none placeholder:text-[var(--color-border)]" />
          </div>

          {/* Advanced: date range */}
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-4 py-2.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] text-left flex items-center gap-1.5 transition-colors border-b border-[var(--color-border)]">
            <span className={`inline-block transition-transform text-[10px] ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
            有效期限
            {!showAdvanced && <span className="opacity-50 ml-0.5">（預設即日起永遠有效）</span>}
          </button>

          {showAdvanced && (
            <div className="px-4 py-3.5 border-b border-[var(--color-border)] space-y-3">
              {/* Start month */}
              <div>
                <p className="text-xs text-[var(--color-muted)] mb-2">開始月份</p>
                <MonthYearPicker value={effectiveFrom} onChange={setEffectiveFrom} />
              </div>

              {/* End: forever toggle or month picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-[var(--color-muted)]">結束</p>
                  <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)] text-xs">
                    <button onClick={() => { setHasEndDate(false); setEffectiveTo('') }}
                      className={`px-3 py-1 transition-colors ${!hasEndDate ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-muted)]'}`}>
                      永遠
                    </button>
                    <button onClick={() => {
                      setHasEndDate(true)
                      if (!effectiveTo) setEffectiveTo(effectiveFrom)
                    }}
                      className={`px-3 py-1 transition-colors border-l border-[var(--color-border)] ${hasEndDate ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-muted)]'}`}>
                      自訂
                    </button>
                  </div>
                </div>
                {hasEndDate && (
                  <MonthYearPicker value={effectiveTo} onChange={setEffectiveTo} />
                )}
              </div>
            </div>
          )}

          <button onClick={handleCreate} disabled={!amount || Number(amount) <= 0 || saving}
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
                {entry.label && <span className="text-xs text-[var(--color-muted)] truncate">{entry.label}</span>}
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
