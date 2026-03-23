'use client'
import { useState, useEffect } from 'react'
import { BASE, fetcher } from '@/lib/api'
import type { Account, AccountType } from '@/lib/types'

type View = 'typePicker' | 'form'

interface AccTypeItem { type: AccountType; label: string; icon: string }
interface AccGroup { label: string; colorClass: string; items: AccTypeItem[] }

const ACC_GROUPS: AccGroup[] = [
  { label: '流動資金', colorClass: 'bg-green-500', items: [
    { type: 'cash', label: '現金', icon: '💵' },
    { type: 'e_wallet', label: '電子錢包', icon: '📲' },
    { type: 'bank', label: '銀行帳戶', icon: '🏦' },
  ]},
  { label: '投資', colorClass: 'bg-indigo-500', items: [
    { type: 'broker', label: '券商', icon: '📈' },
    { type: 'crypto_exchange', label: '加密貨幣交易所', icon: '₿' },
  ]},
  { label: '其他', colorClass: 'bg-slate-400', items: [
    { type: 'other', label: '其他', icon: '📁' },
  ]},
]

const TYPE_LABELS: Record<AccountType, string> = {
  bank: '銀行', broker: '券商', crypto_exchange: '加密貨幣交易所',
  e_wallet: '電子錢包', cash: '現金', other: '其他',
}

interface Props { open: boolean; account?: Account; holdingsCount?: number; onClose: () => void }

export function AccountSidePanel({ open, account, holdingsCount = 0, onClose }: Props) {
  const [view, setView] = useState<View>('typePicker')
  const [pendingType, setPendingType] = useState<AccTypeItem | null>(null)
  const [form, setForm] = useState({ name: '', institution: '', note: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (account) {
      setView('form')
      setForm({ name: account.name, institution: account.institution ?? '', note: account.note ?? '' })
    } else {
      setView('typePicker')
      setPendingType(null)
      setForm({ name: '', institution: '', note: '' })
    }
  }, [open, account])

  const canGoBack = !account && view === 'form'

  async function handleDelete() {
    if (!account) return
    if (holdingsCount > 0) { alert('請先移除所有持倉才能刪除帳戶'); return }
    if (!confirm('確認刪除帳戶？')) return
    const res = await fetch(`${BASE}/accounts/${account.id}`, { method: 'DELETE' })
    if (!res.ok) alert('刪除失敗')
    else onClose()
  }

  async function handleSave() {
    setSaving(true)
    try {
      const url = account ? `${BASE}/accounts/${account.id}` : `${BASE}/accounts`
      const body: Record<string, unknown> = {
        name: form.name.trim(), institution: form.institution.trim() || undefined,
        note: form.note.trim() || undefined,
      }
      if (!account) body.accountType = pendingType!.type
      await fetch(url, {
        method: account ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      onClose()
    } finally { setSaving(false) }
  }

  const pendingIcon = ACC_GROUPS.flatMap(g => g.items).find(i => i.type === pendingType?.type)?.icon
  const title = account ? '編輯帳戶'
    : view === 'typePicker' ? '選擇帳戶類型'
    : (pendingType?.label ?? '新增帳戶')

  return (
    <div className={`fixed inset-y-0 right-0 w-[440px] bg-[var(--color-surface)] shadow-2xl
      transform transition-transform duration-300 z-40 flex flex-col
      ${open ? 'translate-x-0' : 'translate-x-full'}`}>

      <div className="flex items-center h-14 px-4 border-b border-[var(--color-border)] shrink-0">
        <button onClick={canGoBack ? () => setView('typePicker') : onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full
            text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]">
          {canGoBack ? '‹' : '✕'}
        </button>
        <h2 className="flex-1 text-center font-semibold text-sm">{title}</h2>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {view === 'typePicker' && (
          <div>
            {ACC_GROUPS.map(group => (
              <div key={group.label}>
                <div className={`px-4 py-3 ${group.colorClass} text-white font-semibold text-sm`}>
                  {group.label}
                </div>
                {group.items.map(item => (
                  <button key={item.type}
                    onClick={() => { setPendingType(item); setForm(p => ({ ...p, name: item.label })); setView('form') }}
                    className="w-full flex items-center gap-4 px-4 py-4 bg-[var(--color-surface)]
                      hover:bg-[var(--color-bg)] border-b border-[var(--color-border)] transition-colors">
                    <span className="text-xl w-8 text-center">{item.icon}</span>
                    <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                    <span className="text-[var(--color-muted)]">›</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {view === 'form' && (
          <div className="p-4 space-y-4">
            {pendingType && !account && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-bg)]">
                <span className="text-2xl">{pendingIcon}</span>
                <span className="font-medium text-sm">{pendingType.label}</span>
              </div>
            )}
            {account && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-bg)]">
                <span className="text-sm text-[var(--color-muted)]">類型</span>
                <span className="ml-auto text-sm font-medium">{TYPE_LABELS[account.accountType]}</span>
              </div>
            )}

            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
              <div className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5 border-b border-[var(--color-border)]">
                <span className="text-sm text-[var(--color-muted)]">名稱</span>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  autoFocus placeholder="例：台幣活存"
                  className="text-right bg-transparent text-sm outline-none w-full" />
              </div>
              <div className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5 border-b border-[var(--color-border)]">
                <span className="text-sm text-[var(--color-muted)]">機構</span>
                <input value={form.institution}
                  onChange={e => setForm(p => ({ ...p, institution: e.target.value }))}
                  placeholder="選填（例：玉山銀行）"
                  className="text-right bg-transparent text-sm outline-none w-full" />
              </div>
              <div className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5">
                <span className="text-sm text-[var(--color-muted)]">備註</span>
                <input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                  placeholder="選填"
                  className="text-right bg-transparent text-sm outline-none w-full" />
              </div>
            </div>

            <button onClick={handleSave} disabled={!form.name.trim() || saving}
              className="w-full py-3.5 bg-[var(--color-accent)] text-white rounded-xl font-medium disabled:opacity-40">
              {saving ? '儲存中…' : account ? '儲存' : '建立帳戶'}
            </button>
            {account && (
              <button onClick={handleDelete}
                className="w-full py-3 border border-red-400 text-red-500 rounded-xl text-sm">
                刪除帳戶
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
