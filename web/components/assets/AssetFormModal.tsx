'use client'
import { useState, useEffect } from 'react'
import { BASE } from '@/lib/api'
import { fetchWithUser } from '@/lib/user'
import { CATEGORY_BY_CLASS, SUB_KIND_BY_CATEGORY, DEFAULT_PRICING_MODE } from '@/lib/assetTaxonomy'
import type { Asset, AssetClass, Category, SubKind, PricingMode } from '@/lib/types'

interface Props { open: boolean; asset?: Asset; onClose: () => void }

export function AssetFormModal({ open, asset, onClose }: Props) {
  const isEdit = !!asset
  const [form, setForm] = useState({
    name: '', assetClass: 'asset' as AssetClass, category: 'investment' as Category,
    subKind: 'stock' as SubKind, symbol: '', market: '',
    currencyCode: 'USD', pricingMode: 'market' as PricingMode,
  })

  useEffect(() => {
    if (asset) setForm({
      name: asset.name,
      assetClass: asset.assetClass,
      category: asset.category,
      subKind: asset.subKind,
      symbol: asset.symbol ?? '',
      market: asset.market ?? '',
      currencyCode: asset.currencyCode,
      pricingMode: asset.pricingMode,
    })
  }, [asset])

  function set(k: string, v: string) {
    setForm(prev => {
      const next = { ...prev, [k]: v }
      if (k === 'assetClass') {
        next.category = CATEGORY_BY_CLASS[v as AssetClass][0]
        next.subKind = SUB_KIND_BY_CATEGORY[next.category][0]
        next.pricingMode = DEFAULT_PRICING_MODE[next.subKind] ?? 'manual'
      }
      if (k === 'category') {
        next.subKind = SUB_KIND_BY_CATEGORY[v as Category][0]
        next.pricingMode = DEFAULT_PRICING_MODE[next.subKind] ?? 'manual'
      }
      if (k === 'subKind') next.pricingMode = DEFAULT_PRICING_MODE[v] ?? 'manual'
      return next
    })
  }

  async function handleSubmit() {
    const url = isEdit ? `${BASE}/assets/${asset!.id}` : `${BASE}/assets`
    const body = isEdit
      ? { name: form.name, symbol: form.symbol || undefined, market: form.market || undefined }
      : { ...form, symbol: form.symbol || undefined, market: form.market || undefined }
    await fetchWithUser(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    onClose()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-[var(--color-surface)] rounded-lg p-6 w-96 space-y-4">
        <h2 className="font-semibold">{isEdit ? '編輯資產' : '新增資產'}</h2>

        <label className="block">
          <span className="text-sm">名稱</span>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2" />
        </label>

        {!isEdit && (
          <>
            <label className="block">
              <span className="text-sm">資產類別</span>
              <select value={form.assetClass} onChange={e => set('assetClass', e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2">
                <option value="asset">資產</option>
                <option value="liability">負債</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm">Category</span>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2">
                {CATEGORY_BY_CLASS[form.assetClass].map(c =>
                  <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm">Sub-kind</span>
              <select value={form.subKind} onChange={e => set('subKind', e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2">
                {SUB_KIND_BY_CATEGORY[form.category].map(s =>
                  <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm">幣別</span>
              <input value={form.currencyCode} onChange={e => set('currencyCode', e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2" />
            </label>
            <label className="block">
              <span className="text-sm">報價模式</span>
              <select value={form.pricingMode} onChange={e => set('pricingMode', e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2">
                <option value="market">market</option>
                <option value="fixed">fixed</option>
                <option value="manual">manual</option>
              </select>
            </label>
          </>
        )}

        <label className="block">
          <span className="text-sm">Symbol（選填）</span>
          <input value={form.symbol} onChange={e => set('symbol', e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm">Market（選填）</span>
          <input value={form.market} onChange={e => set('market', e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2" />
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
