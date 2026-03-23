'use client'
import { useState, useEffect } from 'react'
import { BASE } from '@/lib/api'
import type { Asset, AssetClass, Category, PricingMode, SubKind, Ticker } from '@/lib/types'
import { TickerSearch } from './TickerSearch'
import { CurrencyPicker } from '@/components/shared/CurrencyPicker'

const LIQUID_SUBKINDS: SubKind[] = ['bank_account', 'physical_cash', 'e_wallet']

type View = 'kindPicker' | 'tickerSearch' | 'form'

interface AssetKindItem {
  subKind: SubKind
  label: string
  icon: string
  assetClass: AssetClass
  category: Category
  useTicker?: boolean  // true → goes to tickerSearch view
}
interface AssetGroup { label: string; colorClass: string; items: AssetKindItem[] }

const PRECIOUS_METALS = [
  { name: '黃金', symbol: 'XAUUSD=X' },
  { name: '白銀', symbol: 'XAGUSD=X' },
  { name: '鉑金', symbol: 'XPTUSD=X' },
]

const ASSET_GROUPS: AssetGroup[] = [
  { label: '流動資金', colorClass: 'bg-green-500', items: [
    { subKind: 'bank_account', label: '銀行存款', icon: '🏦', assetClass: 'asset', category: 'liquid' },
    { subKind: 'physical_cash', label: '現金', icon: '💵', assetClass: 'asset', category: 'liquid' },
    { subKind: 'e_wallet', label: '電子錢包', icon: '📲', assetClass: 'asset', category: 'liquid' },
    { subKind: 'other', label: '其他流動資金', icon: '📦', assetClass: 'asset', category: 'liquid' },
  ]},
  { label: '投資', colorClass: 'bg-indigo-500', items: [
    { subKind: 'stock', label: '股票/ETF', icon: '📊', assetClass: 'asset', category: 'investment', useTicker: true },
    { subKind: 'crypto', label: '加密貨幣', icon: '₿', assetClass: 'asset', category: 'investment', useTicker: true },
    { subKind: 'fund', label: '基金', icon: '💰', assetClass: 'asset', category: 'investment' },
    { subKind: 'precious_metal', label: '實體貴金屬', icon: '🥇', assetClass: 'asset', category: 'investment' },
    { subKind: 'other', label: '其他投資', icon: '📦', assetClass: 'asset', category: 'investment' },
  ]},
  { label: '固定資產', colorClass: 'bg-violet-500', items: [
    { subKind: 'real_estate', label: '不動產', icon: '🏠', assetClass: 'asset', category: 'fixed' },
    { subKind: 'vehicle', label: '車輛', icon: '🚗', assetClass: 'asset', category: 'fixed' },
    { subKind: 'other', label: '其他固定資產', icon: '📦', assetClass: 'asset', category: 'fixed' },
  ]},
  { label: '應收款', colorClass: 'bg-sky-400', items: [
    { subKind: 'receivable', label: '應收款', icon: '📋', assetClass: 'asset', category: 'receivable' },
  ]},
  { label: '負債', colorClass: 'bg-slate-400', items: [
    { subKind: 'credit_card', label: '信用卡', icon: '💳', assetClass: 'liability', category: 'debt' },
    { subKind: 'mortgage', label: '房貸', icon: '🏡', assetClass: 'liability', category: 'debt' },
    { subKind: 'personal_loan', label: '個人貸款', icon: '💸', assetClass: 'liability', category: 'debt' },
    { subKind: 'other', label: '其他負債', icon: '📦', assetClass: 'liability', category: 'debt' },
  ]},
]

const DEFAULT_PRICING: Record<string, PricingMode> = {
  bank_account: 'fixed', physical_cash: 'fixed', stablecoin: 'fixed', e_wallet: 'fixed',
  receivable: 'fixed', credit_card: 'fixed', mortgage: 'fixed', personal_loan: 'fixed',
  stock: 'market', etf: 'market', crypto: 'market',
  fund: 'manual', precious_metal: 'market', real_estate: 'manual', vehicle: 'manual',
}

const SUB_KIND_LABELS: Record<string, string> = {
  bank_account: '銀行存款', physical_cash: '現金', e_wallet: '電子錢包', stablecoin: '穩定幣',
  stock: '股票', etf: 'ETF', fund: '基金', crypto: '加密貨幣', precious_metal: '實體貴金屬',
  real_estate: '不動產', vehicle: '車輛', receivable: '應收款',
  credit_card: '信用卡', mortgage: '房貸', personal_loan: '個人貸款', other: '其他',
}
const PRICING_LABELS: Record<string, string> = { market: '市價', fixed: '固定', manual: '手動' }

interface Props { open: boolean; asset?: Asset; onClose: () => void }

export function AssetSidePanel({ open, asset, onClose }: Props) {
  const [view, setView] = useState<View>('kindPicker')
  const [pendingKind, setPendingKind] = useState<AssetKindItem | null>(null)
  const [selectedTicker, setSelectedTicker] = useState<Ticker | null>(null)
  const [selectedMetal, setSelectedMetal] = useState<typeof PRECIOUS_METALS[number] | null>(null)
  const [form, setForm] = useState({ name: '', symbol: '', currencyCode: 'TWD', unit: '公克' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (asset) {
      setView('form')
      setForm({ name: asset.name, symbol: asset.symbol ?? '', currencyCode: asset.currencyCode, unit: asset.unit ?? '公克' })
    } else {
      setView('kindPicker')
      setPendingKind(null)
      setSelectedTicker(null)
      setSelectedMetal(null)
      setForm({ name: '', symbol: '', currencyCode: 'TWD', unit: '公克' })
    }
  }, [open, asset])

  function handleKindSelect(item: AssetKindItem) {
    setPendingKind(item)
    if (item.useTicker) {
      setSelectedTicker(null)
      setView('tickerSearch')
    } else {
      const isLiquid = LIQUID_SUBKINDS.includes(item.subKind)
      setForm(p => ({
        ...p,
        name: item.label,
        currencyCode: 'TWD',
        unit: isLiquid ? 'TWD' : (item.subKind === 'precious_metal' ? '公克' : ''),
      }))
      setView('form')
    }
  }

  function handleTickerSelect(t: Ticker) {
    setSelectedTicker(t)
    setPendingKind(prev => prev ? { ...prev, subKind: t.type as SubKind } : prev)
    setForm(p => ({
      ...p,
      name: t.name,
      symbol: t.symbol,
      currencyCode: t.type === 'crypto' || t.country === 'US' ? 'USD' : 'TWD',
      unit: t.type === 'crypto' ? t.symbol.toUpperCase() : '股',
    }))
    setView('form')
  }

  function goBack() {
    if (view === 'tickerSearch') { setView('kindPicker'); return }
    if (view === 'form') {
      if (selectedTicker) { setView('tickerSearch'); return }
      setView('kindPicker')
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (asset) {
        await fetch(`${BASE}/assets/${asset.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            symbol: form.symbol.trim() || undefined,
            unit: form.unit || undefined,
          }),
        })
      } else if (pendingKind) {
        await fetch(`${BASE}/assets`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            assetClass: pendingKind.assetClass,
            category: pendingKind.category,
            subKind: pendingKind.subKind,
            currencyCode: form.currencyCode.trim().toUpperCase() || 'TWD',
            pricingMode: DEFAULT_PRICING[pendingKind.subKind] ?? 'manual',
            symbol: form.symbol.trim() || undefined,
            unit: form.unit || undefined,
          }),
        })
      }
      onClose()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!asset || !confirm('確認刪除此資產？若有持倉或快照將無法刪除。')) return
    const res = await fetch(`${BASE}/assets/${asset.id}`, { method: 'DELETE' })
    if (!res.ok) alert('刪除失敗：請先移除所有持倉與快照')
    else onClose()
  }

  const canGoBack = !asset && (view === 'tickerSearch' || view === 'form')
  const isMarket = asset
    ? asset.pricingMode === 'market'
    : pendingKind ? DEFAULT_PRICING[pendingKind.subKind] === 'market' : false

  const title = asset ? '編輯資產'
    : view === 'kindPicker' ? '選擇資產類型'
    : view === 'tickerSearch' ? (pendingKind?.subKind === 'crypto' ? '搜尋加密貨幣' : '搜尋股票/ETF')
    : selectedTicker ? selectedTicker.name
    : (pendingKind?.label ?? '新增資產')

  return (
    <div className={`fixed inset-y-0 right-0 w-[440px] bg-[var(--color-surface)] shadow-2xl
      transform transition-transform duration-300 z-40 flex flex-col
      ${open ? 'translate-x-0' : 'translate-x-full'}`}>

      <div className="flex items-center h-14 px-4 border-b border-[var(--color-border)] shrink-0">
        <button onClick={canGoBack ? goBack : onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full
            text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]">
          {canGoBack ? '‹' : '✕'}
        </button>
        <h2 className="flex-1 text-center font-semibold text-sm">{title}</h2>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ─── Kind picker ─── */}
        {view === 'kindPicker' && (
          <div>
            {ASSET_GROUPS.map(group => (
              <div key={group.label}>
                <div className="px-4 py-2 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                  <span className="text-xs font-semibold tracking-wider text-[var(--color-muted)] uppercase">
                    {group.label}
                  </span>
                </div>
                {group.items.map((item, idx) => (
                  <button key={`${item.subKind}-${idx}`} onClick={() => handleKindSelect(item)}
                    className="w-full flex items-center gap-4 px-4 py-4 bg-[var(--color-surface)]
                      hover:bg-[var(--color-bg)] border-b border-[var(--color-border)] transition-colors">
                    <span className="text-xl w-8 text-center">{item.icon}</span>
                    <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                    {item.useTicker && (
                      <span className="text-xs text-[var(--color-muted)] mr-1">搜尋</span>
                    )}
                    <span className="text-[var(--color-muted)]">›</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ─── Ticker search ─── */}
        {view === 'tickerSearch' && (
          <TickerSearch
            onSelect={handleTickerSelect}
            onBack={goBack}
            defaultMarket={pendingKind?.subKind === 'crypto' ? 'Crypto' : 'TW'}
          />
        )}

        {/* ─── Form ─── */}
        {view === 'form' && (
          <div className="p-4 space-y-4">
            {/* Selected ticker badge */}
            {selectedTicker && !asset && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-bg)]">
                <span className="text-2xl">{pendingKind?.icon}</span>
                <div>
                  <div className="text-xs text-[var(--color-muted)]">{selectedTicker.symbol} · {selectedTicker.exchange}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                    ${selectedTicker.type === 'etf' ? 'bg-indigo-100 text-indigo-700'
                      : selectedTicker.type === 'crypto' ? 'bg-orange-100 text-orange-700'
                      : 'bg-green-100 text-green-700'}`}>
                    {selectedTicker.type === 'etf' ? 'ETF' : selectedTicker.type === 'crypto' ? '加密貨幣' : '股票'}
                  </span>
                </div>
              </div>
            )}
            {/* Non-ticker kind badge */}
            {pendingKind && !asset && !selectedTicker && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-bg)]">
                <span className="text-2xl">{pendingKind.icon}</span>
                <span className="font-medium text-sm">{pendingKind.label}</span>
              </div>
            )}

            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
              {/* Name */}
              <div className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5 border-b border-[var(--color-border)]">
                <span className="text-sm text-[var(--color-muted)]">名稱</span>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  autoFocus={!selectedTicker} placeholder="例：台積電"
                  className="text-right bg-transparent text-sm outline-none w-full" />
              </div>
              {/* Symbol — editable for market assets; read-only for ticker/precious metal */}
              {isMarket && pendingKind?.subKind !== 'precious_metal' && (
                <div className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5 border-b border-[var(--color-border)]">
                  <span className="text-sm text-[var(--color-muted)]">代號</span>
                  {selectedTicker
                    ? <span className="text-right text-sm text-[var(--color-muted)]">{form.symbol}</span>
                    : <input value={form.symbol} onChange={e => setForm(p => ({ ...p, symbol: e.target.value }))}
                        placeholder="例：2330.TW"
                        className="text-right bg-transparent text-sm outline-none w-full" />
                  }
                </div>
              )}
              {/* Liquid: currency picker (currency = unit) */}
              {!asset && pendingKind && LIQUID_SUBKINDS.includes(pendingKind.subKind) && (
                <div className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5">
                  <span className="text-sm text-[var(--color-muted)]">幣別</span>
                  <div className="flex justify-end">
                    <CurrencyPicker value={form.currencyCode}
                      onChange={code => setForm(p => ({ ...p, currencyCode: code, unit: code }))} />
                  </div>
                </div>
              )}
              {/* Precious metal: metal type + unit */}
              {!asset && pendingKind?.subKind === 'precious_metal' && (
                <>
                  <div className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5 border-b border-[var(--color-border)]">
                    <span className="text-sm text-[var(--color-muted)]">金屬</span>
                    <div className="flex justify-end gap-2">
                      {PRECIOUS_METALS.map(m => (
                        <button key={m.symbol} type="button"
                          onClick={() => {
                            setSelectedMetal(m)
                            setForm(p => ({ ...p, name: m.name, symbol: m.symbol, currencyCode: 'USD' }))
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                            ${selectedMetal?.symbol === m.symbol
                              ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                              : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]'}`}>
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5">
                    <span className="text-sm text-[var(--color-muted)]">單位</span>
                    <div className="flex justify-end gap-2">
                      {['公克', '盎司'].map(u => (
                        <button key={u} type="button" onClick={() => setForm(p => ({ ...p, unit: u }))}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                            ${form.unit === u
                              ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                              : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]'}`}>
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {/* Edit mode: read-only type & pricing info */}
              {asset && (
                <>
                  {[
                    { label: '類型', value: SUB_KIND_LABELS[asset.subKind] ?? asset.subKind },
                    { label: '報價', value: PRICING_LABELS[asset.pricingMode] ?? asset.pricingMode },
                    ...(LIQUID_SUBKINDS.includes(asset.subKind as any)
                      ? [{ label: '幣別', value: asset.currencyCode }]
                      : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5 border-t border-[var(--color-border)]">
                      <span className="text-sm text-[var(--color-muted)]">{label}</span>
                      <span className="text-right text-sm text-[var(--color-muted)]">{value}</span>
                    </div>
                  ))}
                  {asset.subKind === 'precious_metal' && (
                    <div className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5 border-t border-[var(--color-border)]">
                      <span className="text-sm text-[var(--color-muted)]">單位</span>
                      <div className="flex justify-end gap-2">
                        {['公克', '盎司'].map(u => (
                          <button key={u} onClick={() => setForm(p => ({ ...p, unit: u }))}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                              ${form.unit === u
                                ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                                : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]'}`}>
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <button onClick={handleSave} disabled={!form.name.trim() || saving}
              className="w-full py-3.5 bg-[var(--color-accent)] text-white rounded-xl font-medium disabled:opacity-40">
              {saving ? '儲存中…' : asset ? '儲存' : '建立資產'}
            </button>
            {asset && (
              <button onClick={handleDelete}
                className="w-full py-3 border border-red-400 text-red-500 rounded-xl text-sm">
                刪除資產
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
