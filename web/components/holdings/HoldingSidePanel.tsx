'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { BASE, fetcher } from '@/lib/api'
import type { Account, Asset, Holding } from '@/lib/types'

type Mode = 'add' | 'edit'
interface Props {
  mode: Mode
  open: boolean
  onClose: () => void
  holding?: Holding
}

export function HoldingSidePanel({ mode, open, onClose, holding }: Props) {
  const [step, setStep] = useState(1)
  const [selectedAccount, setSelectedAccount] = useState('')
  const [selectedAsset, setSelectedAsset] = useState('')
  const [quantity, setQuantity] = useState(holding?.quantity?.toString() ?? '')
  const [note, setNote] = useState('')
  const { data: accounts } = useSWR<Account[]>(`${BASE}/accounts`, fetcher)
  const { data: assets } = useSWR<Asset[]>(`${BASE}/assets`, fetcher)

  async function handleSave() {
    await fetch(`${BASE}/holdings/${selectedAsset || holding!.assetId}/${selectedAccount || holding!.accountId}`,
      { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: parseFloat(quantity) }) })
    if (note) {
      await fetch(`${BASE}/transactions`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: selectedAsset || holding!.assetId,
          accountId: selectedAccount || holding!.accountId,
          txnType: 'adjustment', quantity: parseFloat(quantity),
          txnDate: new Date().toISOString().slice(0, 10), note,
        }) })
    }
    onClose()
  }

  async function handleDelete() {
    await fetch(`${BASE}/holdings/${holding!.assetId}/${holding!.accountId}`, { method: 'DELETE' })
    onClose()
  }

  return (
    <div className={`fixed inset-y-0 right-0 w-96 bg-[var(--color-surface)] shadow-xl
      transform transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">{mode === 'add' ? '新增持倉' : '編輯持倉'}</h2>
        <button onClick={onClose}>✕</button>
      </div>

      {mode === 'edit' && holding && (
        <div className="p-4 space-y-4">
          <p className="font-medium">{holding.assetName} / {holding.accountName}</p>
          <p className="text-sm text-[var(--color-muted)]">
            估值：{holding.latestValueInBase?.toLocaleString() ?? '—'}
          </p>
          <label className="block">
            <span className="text-sm">數量</span>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm">備註（選填）</span>
            <input value={note} onChange={e => setNote(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2" />
          </label>
          <a href={`/assets/${holding.assetId}`}
            className="text-sm text-[var(--color-accent)] underline">查看資產詳情</a>
          <div className="flex gap-2 pt-4">
            <button onClick={handleSave}
              className="flex-1 bg-[var(--color-accent)] text-white rounded py-2">儲存</button>
            <button onClick={handleDelete}
              className="flex-1 border border-[var(--color-coral)] text-[var(--color-coral)] rounded py-2">刪除</button>
          </div>
        </div>
      )}

      {mode === 'add' && (
        <div className="p-4">
          {step === 1 && (
            <div>
              <p className="text-sm mb-2">選擇帳戶</p>
              <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}
                className="w-full border rounded px-3 py-2">
                <option value="">—</option>
                {accounts?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button disabled={!selectedAccount} onClick={() => setStep(2)}
                className="mt-4 w-full bg-[var(--color-accent)] text-white rounded py-2 disabled:opacity-40">下一步</button>
            </div>
          )}
          {step === 2 && (
            <div>
              <p className="text-sm mb-2">選擇資產</p>
              <select value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)}
                className="w-full border rounded px-3 py-2">
                <option value="">— 選擇現有資產 —</option>
                {assets?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setStep(1)} className="flex-1 border rounded py-2">上一步</button>
                <button disabled={!selectedAsset} onClick={() => setStep(3)}
                  className="flex-1 bg-[var(--color-accent)] text-white rounded py-2 disabled:opacity-40">下一步</button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div>
              <label className="block">
                <span className="text-sm">數量</span>
                <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2" />
              </label>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setStep(2)} className="flex-1 border rounded py-2">上一步</button>
                <button disabled={!quantity} onClick={() => setStep(4)}
                  className="flex-1 bg-[var(--color-accent)] text-white rounded py-2 disabled:opacity-40">下一步</button>
              </div>
            </div>
          )}
          {step === 4 && (
            <div>
              <label className="block">
                <span className="text-sm">備註（選填，將建立 adjustment 交易紀錄）</span>
                <input value={note} onChange={e => setNote(e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2" />
              </label>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setStep(3)} className="flex-1 border rounded py-2">上一步</button>
                <button onClick={handleSave}
                  className="flex-1 bg-[var(--color-accent)] text-white rounded py-2">建立</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
