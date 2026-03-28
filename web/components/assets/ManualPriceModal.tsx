'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { BASE } from '@/lib/api'
import { fetchWithUser } from '@/lib/user'

interface Props { assetId: string; open: boolean; onClose: () => void }

export function ManualPriceModal({ assetId, open, onClose }: Props) {
  const tAssets = useTranslations('assets')
  const tCommon = useTranslations('common')
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [price, setPrice] = useState('')

  async function handleSubmit() {
    await fetchWithUser(`${BASE}/prices/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId, priceDate: date, price: parseFloat(price) }),
    })
    onClose()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-[var(--color-surface)] rounded-lg p-6 w-80 space-y-4">
        <h2 className="font-semibold">{tAssets('detail.updatePrice')}</h2>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full border rounded px-3 py-2" />
        <input type="number" placeholder={tAssets('manualPrice.pricePlaceholder')} value={price}
          onChange={e => setPrice(e.target.value)} className="w-full border rounded px-3 py-2" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border rounded py-2">{tCommon('cancel')}</button>
          <button onClick={handleSubmit} disabled={!price}
            className="flex-1 bg-[var(--color-accent)] text-white rounded py-2 disabled:opacity-40">{tCommon('save')}</button>
        </div>
      </div>
    </div>
  )
}
