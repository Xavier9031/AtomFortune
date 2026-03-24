'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { BASE } from '@/lib/api'
import { fetchWithUser } from '@/lib/user'
import type { Asset, AssetClass, Category, PricingMode, SubKind, Ticker } from '@/lib/types'
import { TickerSearch } from './TickerSearch'
import { CurrencyPicker } from '@/components/shared/CurrencyPicker'

const LIQUID_SUBKINDS: SubKind[] = ['bank_account', 'physical_cash', 'e_wallet']

type View = 'kindPicker' | 'tickerSearch' | 'form'

interface AssetKindItem {
  subKind: SubKind
  labelKey: string
  icon: string
  assetClass: AssetClass
  category: Category
  useTicker?: boolean
}
interface AssetGroup { labelKey: string; colorClass: string; items: AssetKindItem[] }

const PRECIOUS_METALS = [
  { nameKey: 'assets.preciousMetals.gold' as const, symbol: 'XAUUSD=X' },
  { nameKey: 'assets.preciousMetals.silver' as const, symbol: 'XAGUSD=X' },
  { nameKey: 'assets.preciousMetals.platinum' as const, symbol: 'XPTUSD=X' },
]

const UNIT_OPTIONS = [
  { value: '公克', tKey: 'assets.units.gram' as const },
  { value: '盎司', tKey: 'assets.units.ounce' as const },
]

const ASSET_GROUPS: AssetGroup[] = [
  { labelKey: 'asset.groups.liquid', colorClass: 'bg-green-500', items: [
    { subKind: 'bank_account', labelKey: 'asset.subKinds.bank_account', icon: '🏦', assetClass: 'asset', category: 'liquid' },
    { subKind: 'physical_cash', labelKey: 'asset.subKinds.physical_cash', icon: '💵', assetClass: 'asset', category: 'liquid' },
    { subKind: 'e_wallet', labelKey: 'asset.subKinds.e_wallet', icon: '📲', assetClass: 'asset', category: 'liquid' },
    { subKind: 'other', labelKey: 'asset.itemLabels.liquid_other', icon: '📦', assetClass: 'asset', category: 'liquid' },
  ]},
  { labelKey: 'asset.groups.investment', colorClass: 'bg-indigo-500', items: [
    { subKind: 'stock', labelKey: 'asset.itemLabels.stock_etf', icon: '📊', assetClass: 'asset', category: 'investment', useTicker: true },
    { subKind: 'crypto', labelKey: 'asset.subKinds.crypto', icon: '₿', assetClass: 'asset', category: 'investment', useTicker: true },
    { subKind: 'fund', labelKey: 'asset.subKinds.fund', icon: '💰', assetClass: 'asset', category: 'investment' },
    { subKind: 'precious_metal', labelKey: 'asset.subKinds.precious_metal', icon: '🥇', assetClass: 'asset', category: 'investment' },
    { subKind: 'other', labelKey: 'asset.itemLabels.investment_other', icon: '📦', assetClass: 'asset', category: 'investment' },
  ]},
  { labelKey: 'asset.groups.fixed', colorClass: 'bg-violet-500', items: [
    { subKind: 'real_estate', labelKey: 'asset.subKinds.real_estate', icon: '🏠', assetClass: 'asset', category: 'fixed' },
    { subKind: 'vehicle', labelKey: 'asset.subKinds.vehicle', icon: '🚗', assetClass: 'asset', category: 'fixed' },
    { subKind: 'other', labelKey: 'asset.itemLabels.fixed_other', icon: '📦', assetClass: 'asset', category: 'fixed' },
  ]},
  { labelKey: 'asset.groups.receivable', colorClass: 'bg-sky-400', items: [
    { subKind: 'receivable', labelKey: 'asset.subKinds.receivable', icon: '📋', assetClass: 'asset', category: 'receivable' },
  ]},
  { labelKey: 'asset.groups.debt', colorClass: 'bg-slate-400', items: [
    { subKind: 'credit_card', labelKey: 'asset.subKinds.credit_card', icon: '💳', assetClass: 'liability', category: 'debt' },
    { subKind: 'mortgage', labelKey: 'asset.subKinds.mortgage', icon: '🏡', assetClass: 'liability', category: 'debt' },
    { subKind: 'personal_loan', labelKey: 'asset.subKinds.personal_loan', icon: '💸', assetClass: 'liability', category: 'debt' },
    { subKind: 'other', labelKey: 'asset.itemLabels.debt_other', icon: '📦', assetClass: 'liability', category: 'debt' },
  ]},
]

const DEFAULT_PRICING: Record<string, PricingMode> = {
  bank_account: 'fixed', physical_cash: 'fixed', stablecoin: 'fixed', e_wallet: 'fixed',
  receivable: 'fixed', credit_card: 'fixed', mortgage: 'fixed', personal_loan: 'fixed',
  stock: 'market', etf: 'market', crypto: 'market',
  fund: 'manual', precious_metal: 'market', real_estate: 'manual', vehicle: 'manual',
}

interface Props { open: boolean; asset?: Asset; onClose: () => void }

export function AssetSidePanel({ open, asset, onClose }: Props) {
  const t = useTranslations()
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
        name: t(item.labelKey as Parameters<typeof t>[0]),
        currencyCode: 'TWD',
        unit: isLiquid ? 'TWD' : (item.subKind === 'precious_metal' ? '公克' : ''),
      }))
      setView('form')
    }
  }

  function handleTickerSelect(ticker: Ticker) {
    setSelectedTicker(ticker)
    setPendingKind(prev => prev ? { ...prev, subKind: ticker.type as SubKind } : prev)
    setForm(p => ({
      ...p,
      name: ticker.name,
      symbol: ticker.symbol,
      currencyCode: ticker.type === 'crypto' || ticker.country === 'US' ? 'USD' : 'TWD',
      unit: ticker.type === 'crypto' ? ticker.symbol.toUpperCase() : '股',
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
        await fetchWithUser(`${BASE}/assets/${asset.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            symbol: form.symbol.trim() || undefined,
            unit: form.unit || undefined,
          }),
        })
      } else if (pendingKind) {
        await fetchWithUser(`${BASE}/assets`, {
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
    if (!asset || !confirm(t('assets.deleteConfirm'))) return
    const res = await fetchWithUser(`${BASE}/assets/${asset.id}`, { method: 'DELETE' })
    if (!res.ok) alert(t('assets.deleteFailed'))
    else onClose()
  }

  const canGoBack = !asset && (view === 'tickerSearch' || view === 'form')
  const isMarket = asset
    ? asset.pricingMode === 'market'
    : pendingKind ? DEFAULT_PRICING[pendingKind.subKind] === 'market' : false

  const title = asset ? t('assets.editTitle')
    : view === 'kindPicker' ? t('assets.kindPickerTitle')
    : view === 'tickerSearch' ? (pendingKind?.subKind === 'crypto' ? t('assets.tickerSearch.crypto') : t('assets.tickerSearch.stockEtf'))
    : selectedTicker ? selectedTicker.name
    : (pendingKind ? t(pendingKind.labelKey as Parameters<typeof t>[0]) : t('assets.newAssetTitle'))

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
              <div key={group.labelKey}>
                <div className="px-4 py-2 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                  <span className="text-xs font-semibold tracking-wider text-[var(--color-muted)] uppercase">
                    {t(group.labelKey as Parameters<typeof t>[0])}
                  </span>
                </div>
                {group.items.map((item, idx) => (
                  <button key={`${item.subKind}-${idx}`} onClick={() => handleKindSelect(item)}
                    className="w-full flex items-center gap-4 px-4 py-4 bg-[var(--color-surface)]
                      hover:bg-[var(--color-bg)] border-b border-[var(--color-border)] transition-colors">
                    <span className="text-xl w-8 text-center">{item.icon}</span>
                    <span className="text-sm font-medium flex-1 text-left">
                      {t(item.labelKey as Parameters<typeof t>[0])}
                    </span>
                    {item.useTicker && (
                      <span className="text-xs text-[var(--color-muted)] mr-1">{t('assets.search')}</span>
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
                    {selectedTicker.type === 'etf' ? 'ETF'
                      : selectedTicker.type === 'crypto' ? t('assets.tickerTypes.crypto')
                      : t('assets.tickerTypes.stock')}
                  </span>
                </div>
              </div>
            )}
            {/* Non-ticker kind badge */}
            {pendingKind && !asset && !selectedTicker && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-bg)]">
                <span className="text-2xl">{pendingKind.icon}</span>
                <span className="font-medium text-sm">
                  {t(pendingKind.labelKey as Parameters<typeof t>[0])}
                </span>
              </div>
            )}

            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
              {/* Name */}
              <div className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5 border-b border-[var(--color-border)]">
                <span className="text-sm text-[var(--color-muted)]">{t('assets.form.nameLabel')}</span>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  autoFocus={!selectedTicker} placeholder={t('assets.form.namePlaceholder')}
                  className="text-right bg-transparent text-sm outline-none w-full" />
              </div>
              {/* Symbol — editable for market assets; read-only for ticker/precious metal */}
              {isMarket && pendingKind?.subKind !== 'precious_metal' && (
                <div className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5 border-b border-[var(--color-border)]">
                  <span className="text-sm text-[var(--color-muted)]">{t('assets.form.symbolLabel')}</span>
                  {selectedTicker
                    ? <span className="text-right text-sm text-[var(--color-muted)]">{form.symbol}</span>
                    : <input value={form.symbol} onChange={e => setForm(p => ({ ...p, symbol: e.target.value }))}
                        placeholder={t('assets.detail.symbolPlaceholder')}
                        className="text-right bg-transparent text-sm outline-none w-full" />
                  }
                </div>
              )}
              {/* Liquid: currency picker (currency = unit) */}
              {!asset && pendingKind && LIQUID_SUBKINDS.includes(pendingKind.subKind) && (
                <div className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5">
                  <span className="text-sm text-[var(--color-muted)]">{t('assets.form.currencyLabel')}</span>
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
                    <span className="text-sm text-[var(--color-muted)]">{t('assets.form.metalLabel')}</span>
                    <div className="flex justify-end gap-2">
                      {PRECIOUS_METALS.map(m => (
                        <button key={m.symbol} type="button"
                          onClick={() => {
                            setSelectedMetal(m)
                            setForm(p => ({ ...p, name: t(m.nameKey), symbol: m.symbol, currencyCode: 'USD' }))
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                            ${selectedMetal?.symbol === m.symbol
                              ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                              : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]'}`}>
                          {t(m.nameKey)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5">
                    <span className="text-sm text-[var(--color-muted)]">{t('assets.form.unitLabel')}</span>
                    <div className="flex justify-end gap-2">
                      {UNIT_OPTIONS.map(u => (
                        <button key={u.value} type="button" onClick={() => setForm(p => ({ ...p, unit: u.value }))}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                            ${form.unit === u.value
                              ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                              : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]'}`}>
                          {t(u.tKey)}
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
                    { label: t('assets.detail.typeLabel'), value: t(`asset.subKinds.${asset.subKind}` as Parameters<typeof t>[0], { defaultValue: asset.subKind }) },
                    { label: t('assets.detail.pricingLabel'), value: t(`asset.pricingModes.${asset.pricingMode}` as Parameters<typeof t>[0], { defaultValue: asset.pricingMode }) },
                    ...(LIQUID_SUBKINDS.includes(asset.subKind as SubKind)
                      ? [{ label: t('assets.form.currencyLabel'), value: asset.currencyCode }]
                      : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5 border-t border-[var(--color-border)]">
                      <span className="text-sm text-[var(--color-muted)]">{label}</span>
                      <span className="text-right text-sm text-[var(--color-muted)]">{value}</span>
                    </div>
                  ))}
                  {asset.subKind === 'precious_metal' && (
                    <div className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5 border-t border-[var(--color-border)]">
                      <span className="text-sm text-[var(--color-muted)]">{t('assets.form.unitLabel')}</span>
                      <div className="flex justify-end gap-2">
                        {UNIT_OPTIONS.map(u => (
                          <button key={u.value} onClick={() => setForm(p => ({ ...p, unit: u.value }))}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                              ${form.unit === u.value
                                ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                                : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]'}`}>
                            {t(u.tKey)}
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
              {saving ? t('common.saving') : asset ? t('common.save') : t('assets.createButton')}
            </button>
            {asset && (
              <button onClick={handleDelete}
                className="w-full py-3 border border-red-400 text-red-500 rounded-xl text-sm">
                {t('assets.deleteButton')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
