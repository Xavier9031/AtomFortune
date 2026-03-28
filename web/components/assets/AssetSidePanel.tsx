'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { BASE } from '@/lib/api'
import { fetchWithUser } from '@/lib/user'
import { getDefaultPricingMode, getDefaultUnitForSubKind, getDisplayUnit, isLiquidSubKind, isMarketPricedSubKind } from '@/lib/assetRules'
import { ASSET_GROUPS, PRECIOUS_METALS, UNIT_OPTIONS, type AssetKindItem } from '@/lib/assetCatalog'
import type { Asset, SubKind, Ticker } from '@/lib/types'
import { TickerSearch } from './TickerSearch'
import { CurrencyPicker } from '@/components/shared/CurrencyPicker'

type View = 'kindPicker' | 'tickerSearch' | 'form'

interface Props { open: boolean; asset?: Asset; onClose: () => void }

export function AssetSidePanel({ open, asset, onClose }: Props) {
  const t = useTranslations()
  const [view, setView] = useState<View>('kindPicker')
  const [pendingKind, setPendingKind] = useState<AssetKindItem | null>(null)
  const [selectedTicker, setSelectedTicker] = useState<Ticker | null>(null)
  const [selectedMetal, setSelectedMetal] = useState<typeof PRECIOUS_METALS[number] | null>(null)
  const [form, setForm] = useState({ name: '', symbol: '', currencyCode: 'TWD', unit: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (asset) {
      setView('form')
      setForm({
        name: asset.name,
        symbol: asset.symbol ?? '',
        currencyCode: asset.currencyCode,
        unit: getDisplayUnit(asset),
      })
    } else {
      setView('kindPicker')
      setPendingKind(null)
      setSelectedTicker(null)
      setSelectedMetal(null)
      setForm({ name: '', symbol: '', currencyCode: 'TWD', unit: '' })
    }
  }, [open, asset])

  function handleKindSelect(item: AssetKindItem) {
    setPendingKind(item)
    if (item.useTicker) {
      setSelectedTicker(null)
      setView('tickerSearch')
    } else {
      setForm(p => ({
        ...p,
        name: t(item.labelKey as Parameters<typeof t>[0]),
        currencyCode: 'TWD',
        unit: getDefaultUnitForSubKind({ subKind: item.subKind, currencyCode: 'TWD' }),
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
      unit: getDefaultUnitForSubKind({
        subKind: ticker.type,
        currencyCode: ticker.type === 'crypto' || ticker.country === 'US' ? 'USD' : 'TWD',
        symbol: ticker.symbol,
      }),
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
            pricingMode: getDefaultPricingMode(pendingKind.subKind),
            symbol: form.symbol.trim() || undefined,
            unit: form.unit || undefined,
          }),
        })
      }
      onClose()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!asset) return
    const res = await fetchWithUser(`${BASE}/assets/${asset.id}`, { method: 'DELETE' })
    if (!res.ok) alert(t('assets.deleteFailed'))
    else onClose()
  }

  const canGoBack = !asset && (view === 'tickerSearch' || view === 'form')
  const isMarket = asset
    ? asset.pricingMode === 'market'
    : pendingKind ? isMarketPricedSubKind(pendingKind.subKind) : false

  const title = asset ? t('assets.editTitle')
    : view === 'kindPicker' ? t('assets.kindPickerTitle')
    : view === 'tickerSearch' ? (pendingKind?.subKind === 'crypto' ? t('assets.tickerSearch.crypto') : t('assets.tickerSearch.stockEtf'))
    : selectedTicker ? selectedTicker.name
    : (pendingKind ? t(pendingKind.labelKey as Parameters<typeof t>[0]) : t('assets.newAssetTitle'))

  return (
    <div className={`fixed inset-y-0 right-0 w-full md:w-[440px] bg-[var(--color-surface)] shadow-2xl
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
              {!asset && pendingKind && isLiquidSubKind(pendingKind.subKind) && (
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
                    ...(isLiquidSubKind(asset.subKind)
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
