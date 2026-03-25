'use client'
import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { useTranslations } from 'next-intl'
import { BASE, fetcher } from '@/lib/api'
import { fetchWithUser } from '@/lib/user'
import type { RecurringEntry } from '@/lib/types'

// ── Month/Year picker ────────────────────────────────────────────────────────

function getMonthNames(): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(2000, i, 1))
  )
}

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
  const months = getMonthNames()
  const sel = `bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg
    px-2 py-1 text-xs outline-none focus:border-[var(--color-accent)] appearance-none
    cursor-pointer text-[var(--color-text)]`
  return (
    <div className="flex gap-2">
      <select value={year} onChange={e => onChange(toYYYYMMDD(Number(e.target.value), month))} className={`w-16 ${sel}`}>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <select value={month} onChange={e => onChange(toYYYYMMDD(year, Number(e.target.value)))} className={`flex-1 ${sel}`}>
        {months.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
      </select>
    </div>
  )
}

// ── Shared form (bubble style) ───────────────────────────────────────────────

interface EntryFormProps {
  type: 'income' | 'expense'; setType: (v: 'income' | 'expense') => void
  amount: string; setAmount: (v: string) => void
  quantity: string; setQuantity: (v: string) => void
  currencyCode: string; setCurrencyCode: (v: string) => void
  dayOfMonth: number; setDayOfMonth: (v: number) => void
  label: string; setLabel: (v: string) => void
  showAdvanced: boolean; setShowAdvanced: (v: boolean) => void
  effectiveFrom: string; setEffectiveFrom: (v: string) => void
  hasEndDate: boolean; setHasEndDate: (v: boolean) => void
  effectiveTo: string; setEffectiveTo: (v: string) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  saveLabel?: string | null
  unit?: string | null
}

function EntryForm({
  type, setType, amount, setAmount, quantity, setQuantity, currencyCode, setCurrencyCode,
  dayOfMonth, setDayOfMonth, label, setLabel,
  showAdvanced, setShowAdvanced, effectiveFrom, setEffectiveFrom,
  hasEndDate, setHasEndDate, effectiveTo, setEffectiveTo,
  onSave, onCancel, saving, saveLabel, unit,
}: EntryFormProps) {
  const t = useTranslations()
  const isQuantityMode = !!unit
  const canSave = isQuantityMode
    ? (!!quantity && Number(quantity) > 0)
    : (!!amount && Number(amount) > 0)
  const resolvedSaveLabel = saveLabel ?? t('recurringEntries.saveButton')

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl overflow-hidden"
      style={{ animation: 'bubbleIn 0.2s cubic-bezier(0.34,1.4,0.64,1) both' }}>

      {/* Type toggle */}
      <div className="flex border-b border-[var(--color-border)]">
        {(['income', 'expense'] as const).map(kind => (
          <button key={kind} onClick={() => setType(kind)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors
              ${type === kind
                ? kind === 'income' ? 'bg-green-500/15 text-green-400' : 'bg-red-400/15 text-red-400'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}>
            {isQuantityMode
              ? (kind === 'income' ? t('recurringEntries.typeBuy') : t('recurringEntries.typeSell'))
              : (kind === 'income' ? t('recurringEntries.typeIncome') : t('recurringEntries.typeExpense'))}
          </button>
        ))}
      </div>

      {/* Amount or Quantity */}
      <div className="flex items-baseline gap-2 px-4 pt-3 pb-2">
        {isQuantityMode ? (
          <>
            <input type="number" value={quantity} min="0" autoFocus
              onFocus={e => e.target.select()}
              onChange={e => setQuantity(e.target.value)}
              placeholder="0"
              className="flex-1 text-right bg-transparent text-2xl font-bold outline-none tabular-nums
                [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            <span className="w-11 bg-transparent text-sm font-semibold text-[var(--color-muted)] text-center pb-0.5">{unit}</span>
          </>
        ) : (
          <>
            <input type="number" value={amount} min="0" autoFocus
              onFocus={e => e.target.select()}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="flex-1 text-right bg-transparent text-2xl font-bold outline-none tabular-nums
                [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            <input value={currencyCode} maxLength={4}
              onChange={e => setCurrencyCode(e.target.value.toUpperCase())}
              className="w-11 bg-transparent text-sm font-semibold text-[var(--color-muted)] text-center outline-none pb-0.5" />
          </>
        )}
      </div>

      {/* Day + label */}
      <div className="flex items-center gap-3 px-4 pb-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-1 text-xs text-[var(--color-muted)] shrink-0">
          <span>{t('recurringEntries.monthlyOnDay')}</span>
          <input type="number" min="1" max="31" value={dayOfMonth}
            onFocus={e => e.target.select()}
            onChange={e => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
            className="w-7 bg-transparent text-xs font-semibold text-center outline-none border-b border-[var(--color-border)]
              [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
          <span>{t('recurringEntries.daySuffix')}</span>
        </div>
        <input placeholder={t('recurringEntries.validityOptional')} value={label}
          onChange={e => setLabel(e.target.value)}
          className="flex-1 bg-transparent text-xs outline-none text-[var(--color-text)] placeholder:text-[var(--color-border)]" />
      </div>

      {/* Advanced */}
      <button onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full text-left text-xs text-[var(--color-muted)] flex items-center gap-1.5 px-4 py-2.5 hover:text-[var(--color-text)] transition-colors">
        <span className={`inline-block transition-transform text-[10px] ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
        {t('recurringEntries.validityTitle')}
        {!showAdvanced && <span className="opacity-40">{t('recurringEntries.validityOptional')}</span>}
      </button>

      {showAdvanced && (
        <div className="space-y-3 px-4 pb-3 border-t border-[var(--color-border)]">
          <div className="pt-3">
            <p className="text-xs text-[var(--color-muted)] mb-2">{t('recurringEntries.startMonth')}</p>
            <MonthYearPicker value={effectiveFrom} onChange={setEffectiveFrom} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[var(--color-muted)]">{t('recurringEntries.endLabel')}</p>
              <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)] text-xs">
                <button onClick={() => { setHasEndDate(false); setEffectiveTo('') }}
                  className={`px-3 py-1 transition-colors ${!hasEndDate ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-muted)]'}`}>{t('recurringEntries.forever')}</button>
                <button onClick={() => { setHasEndDate(true); if (!effectiveTo) setEffectiveTo(effectiveFrom) }}
                  className={`px-3 py-1 transition-colors border-l border-[var(--color-border)] ${hasEndDate ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-muted)]'}`}>{t('recurringEntries.custom')}</button>
              </div>
            </div>
            {hasEndDate && <MonthYearPicker value={effectiveTo} onChange={setEffectiveTo} />}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex border-t border-[var(--color-border)]">
        <button onClick={onCancel}
          className="flex-1 py-2.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors border-r border-[var(--color-border)]">
          {t('common.cancel')}
        </button>
        <button onClick={onSave} disabled={!canSave || saving}
          className="flex-1 py-2.5 text-xs font-semibold text-[var(--color-accent)] disabled:opacity-40 transition-opacity">
          {saving ? t('recurringEntries.savingLabel') : resolvedSaveLabel}
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

function useFormState(defaults?: Partial<RecurringEntry>) {
  const now = new Date().toISOString().slice(0, 10)
  const [type, setType] = useState<'income' | 'expense'>((defaults?.type as 'income' | 'expense') ?? 'income')
  const [amount, setAmount] = useState(defaults?.amount ? String(Number(defaults.amount)) : '')
  const [quantity, setQuantity] = useState(defaults?.quantity ? String(Number(defaults.quantity)) : '')
  const [currencyCode, setCurrencyCode] = useState(defaults?.currencyCode ?? 'TWD')
  const [dayOfMonth, setDayOfMonth] = useState(defaults?.dayOfMonth ?? 1)
  const [label, setLabel] = useState(defaults?.label ?? '')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [effectiveFrom, setEffectiveFrom] = useState(defaults?.effectiveFrom ?? now)
  const [hasEndDate, setHasEndDate] = useState(!!defaults?.effectiveTo)
  const [effectiveTo, setEffectiveTo] = useState(defaults?.effectiveTo ?? '')
  const [saving, setSaving] = useState(false)

  function reset() {
    setType('income'); setAmount(''); setQuantity(''); setCurrencyCode('TWD')
    setDayOfMonth(1); setLabel(''); setShowAdvanced(false)
    setEffectiveFrom(now); setHasEndDate(false); setEffectiveTo('')
  }

  function fill(entry: RecurringEntry) {
    setType(entry.type as 'income' | 'expense')
    setAmount(String(Number(entry.amount)))
    setQuantity(entry.quantity ? String(Number(entry.quantity)) : '')
    setCurrencyCode(entry.currencyCode)
    setDayOfMonth(entry.dayOfMonth)
    setLabel(entry.label ?? '')
    setShowAdvanced(false)
    setEffectiveFrom(entry.effectiveFrom)
    setHasEndDate(!!entry.effectiveTo)
    setEffectiveTo(entry.effectiveTo ?? '')
  }

  return {
    type, setType, amount, setAmount, quantity, setQuantity, currencyCode, setCurrencyCode,
    dayOfMonth, setDayOfMonth, label, setLabel,
    showAdvanced, setShowAdvanced, effectiveFrom, setEffectiveFrom,
    hasEndDate, setHasEndDate, effectiveTo, setEffectiveTo,
    saving, setSaving, reset, fill,
    payload: {
      type, amount: Number(amount), quantity: quantity ? Number(quantity) : undefined,
      currencyCode, dayOfMonth,
      label: label || undefined, effectiveFrom,
      effectiveTo: hasEndDate && effectiveTo ? effectiveTo : undefined,
    },
  }
}

export function RecurringEntriesPanel({ assetId, accountId, unit }: { assetId: string; accountId?: string; unit?: string | null }) {
  const t = useTranslations()
  const swrKey = `${BASE}/recurring-entries?assetId=${assetId}${accountId ? `&accountId=${accountId}` : ''}`
  const { data: entries, mutate: revalidate } = useSWR<RecurringEntry[]>(swrKey, fetcher)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const create = useFormState()
  const edit = useFormState()

  async function handleCreate() {
    const validAmount = unit ? (!!create.quantity && Number(create.quantity) > 0) : (!!create.amount && Number(create.amount) > 0)
    if (!validAmount) return
    create.setSaving(true)
    await fetchWithUser(`${BASE}/recurring-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId, accountId: accountId || undefined, ...create.payload }),
    })
    create.setSaving(false); setShowForm(false); create.reset()
    revalidate(); mutate(`${BASE}/recurring-entries`)
  }

  async function handleUpdate() {
    const validAmount = unit ? (!!edit.quantity && Number(edit.quantity) > 0) : (!!edit.amount && Number(edit.amount) > 0)
    if (!validAmount) return
    edit.setSaving(true)
    await fetchWithUser(`${BASE}/recurring-entries/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edit.payload),
    })
    edit.setSaving(false); setEditingId(null)
    revalidate(); mutate(`${BASE}/recurring-entries`)
  }

  async function handleDelete(id: string) {
    await fetchWithUser(`${BASE}/recurring-entries/${id}`, { method: 'DELETE' })
    if (editingId === id) setEditingId(null)
    revalidate(); mutate(`${BASE}/recurring-entries`)
  }

  function openEdit(entry: RecurringEntry) {
    edit.fill(entry)
    setEditingId(entry.id)
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="pt-2">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">{t('recurringEntries.sectionTitle')}</p>
        <button
          onClick={() => { setShowForm(!showForm); if (showForm) create.reset() }}
          className={`text-xs px-2.5 py-1 rounded-full transition-colors
            ${showForm ? 'text-[var(--color-muted)]' : 'text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10'}`}>
          {showForm ? t('common.cancel') : t('recurringEntries.addButton')}
        </button>
      </div>

      {/* ── Create form ── */}
      {showForm && (
        <div className="mb-3">
          <EntryForm
            {...create}
            onSave={handleCreate}
            onCancel={() => { setShowForm(false); create.reset() }}
            saving={create.saving}
            saveLabel={t('recurringEntries.createButton')}
            unit={unit}
          />
        </div>
      )}

      {/* ── Entry list ── */}
      {entries && entries.length > 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
          {entries.map((entry, i) => {
            const isActive = entry.effectiveFrom <= today && (!entry.effectiveTo || entry.effectiveTo >= today)
            const isEditing = editingId === entry.id

            return (
              <div key={entry.id}
                className={i < entries.length - 1 ? 'border-b border-[var(--color-border)]' : ''}>

                {/* Summary row */}
                <div
                  onClick={() => !isEditing && openEdit(entry)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                    ${!isEditing ? 'cursor-pointer hover:bg-[var(--color-bg)]' : ''}
                    ${!isActive ? 'opacity-40' : ''}`}>
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${entry.type === 'income' ? 'bg-green-500' : 'bg-red-400'}`} />
                  <span className={`font-semibold tabular-nums shrink-0 ${entry.type === 'income' ? 'text-green-500' : 'text-red-400'}`}>
                    {entry.type === 'income' ? '+' : '-'}
                    {entry.quantity != null
                      ? `${Number(entry.quantity).toLocaleString()} ${unit ?? ''}`
                      : `${Number(entry.amount).toLocaleString()} ${entry.currencyCode}`}
                  </span>
                  <span className="text-xs text-[var(--color-muted)] shrink-0">{t('recurringEntries.monthlyOnDay')}{entry.dayOfMonth}{t('recurringEntries.daySuffix')}</span>
                  {entry.label && <span className="text-xs text-[var(--color-muted)] truncate">{entry.label}</span>}
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(entry.id) }}
                    className="ml-auto text-[var(--color-muted)] hover:text-red-400 transition-colors shrink-0 text-base leading-none">
                    ×
                  </button>
                </div>

                {/* Edit bubble */}
                {isEditing && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setEditingId(null)} />
                    <div className="relative z-20 mx-2 mt-2 mb-2.5">
                      <EntryForm
                        {...edit}
                        onSave={handleUpdate}
                        onCancel={() => setEditingId(null)}
                        saving={edit.saving}
                        saveLabel={t('recurringEntries.saveButton')}
                        unit={unit}
                      />
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      ) : !showForm ? (
        <p className="text-xs text-[var(--color-muted)] text-center py-3">{t('recurringEntries.noneYet')}</p>
      ) : null}
    </div>
  )
}
