'use client'
import { useState, useEffect } from 'react'
import { BASE } from '@/lib/api'
import type { Account, AccountType } from '@/lib/types'

const ACCOUNT_TYPES: AccountType[] = ['bank', 'broker', 'crypto_exchange', 'e_wallet', 'cash', 'other']
const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: '銀行', broker: '券商', crypto_exchange: '加密貨幣交易所',
  e_wallet: '電子錢包', cash: '現金', other: '其他',
}
const LIQUID_TYPES: AccountType[] = ['bank', 'cash', 'e_wallet']

export function AccountFormModal({ open, account, onClose }: { open: boolean; account?: Account; onClose: () => void }) {
  const [form, setForm] = useState({
    name: '', institution: '', accountType: 'bank' as AccountType, note: '',
    balance: '', currencyCode: 'TWD',
  })

  useEffect(() => {
    if (account) {
      setForm({
        name: account.name,
        institution: account.institution ?? '',
        accountType: account.accountType,
        note: account.note ?? '',
        balance: account.balance ? String(parseFloat(account.balance)) : '',
        currencyCode: 'TWD',
      })
    } else {
      setForm({ name: '', institution: '', accountType: 'bank', note: '', balance: '', currencyCode: 'TWD' })
    }
  }, [account, open])

  const isLiquid = LIQUID_TYPES.includes(form.accountType)

  async function handleSubmit() {
    const url = account ? `${BASE}/accounts/${account.id}` : `${BASE}/accounts`
    const body: Record<string, unknown> = {
      name: form.name,
      institution: form.institution || undefined,
      accountType: form.accountType,
      note: form.note || undefined,
    }
    if (!account && isLiquid && form.balance !== '') {
      body.initialBalance = parseFloat(form.balance)
      body.currencyCode = form.currencyCode
    }
    await fetch(url, {
      method: account ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (account && isLiquid && form.balance !== '') {
      await fetch(`${BASE}/accounts/${account.id}/balance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: parseFloat(form.balance), currencyCode: form.currencyCode }),
      })
    }
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
            {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        {isLiquid && (
          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="text-sm">餘額</span>
              <input type="number" value={form.balance}
                onChange={e => setForm(p => ({ ...p, balance: e.target.value }))}
                placeholder="0"
                className="mt-1 w-full border rounded px-3 py-2" />
            </label>
            <label className="block w-24">
              <span className="text-sm">幣別</span>
              <input value={form.currencyCode}
                onChange={e => setForm(p => ({ ...p, currencyCode: e.target.value.toUpperCase() }))}
                className="mt-1 w-full border rounded px-3 py-2" />
            </label>
          </div>
        )}
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
