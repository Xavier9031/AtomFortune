'use client'
import { useState, useEffect } from 'react'
import { BASE } from '@/lib/api'
import type { Account, AccountType } from '@/lib/types'

const ACCOUNT_TYPES: AccountType[] = ['bank', 'broker', 'crypto_exchange', 'e_wallet', 'cash', 'other']

export function AccountFormModal({ open, account, onClose }: { open: boolean; account?: Account; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', institution: '', accountType: 'bank' as AccountType, note: '' })

  useEffect(() => {
    if (account) setForm({
      name: account.name,
      institution: account.institution ?? '',
      accountType: account.accountType,
      note: account.note ?? '',
    })
  }, [account])

  async function handleSubmit() {
    const url = account ? `${BASE}/accounts/${account.id}` : `${BASE}/accounts`
    await fetch(url, {
      method: account ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        institution: form.institution || undefined,
        accountType: form.accountType,
        note: form.note || undefined,
      }),
    })
    onClose()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-[var(--color-surface)] rounded-lg p-6 w-96 space-y-4">
        <h2 className="font-semibold">{account ? '編輯帳戶' : '新增帳戶'}</h2>
        <label className="block">
          <span className="text-sm">名稱</span>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            className="mt-1 w-full border rounded px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm">機構（選填）</span>
          <input value={form.institution} onChange={e => setForm(p => ({ ...p, institution: e.target.value }))}
            className="mt-1 w-full border rounded px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm">帳戶類型</span>
          <select value={form.accountType} onChange={e => setForm(p => ({ ...p, accountType: e.target.value as AccountType }))}
            className="mt-1 w-full border rounded px-3 py-2">
            {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm">備註（選填）</span>
          <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
            className="mt-1 w-full border rounded px-3 py-2" rows={2} />
        </label>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border rounded py-2">取消</button>
          <button onClick={handleSubmit}
            className="flex-1 bg-[var(--color-accent)] text-white rounded py-2">儲存</button>
        </div>
      </div>
    </div>
  )
}
