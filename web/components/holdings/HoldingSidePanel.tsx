'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import useSWR, { mutate as globalMutate } from 'swr'
import { BASE, fetcher } from '@/lib/api'
import { RecurringEntriesPanel } from '@/components/assets/RecurringEntriesPanel'
import type { Account, AccountType, Asset, AssetClass, Category, Holding, PricingMode, SubKind, Ticker, Transaction } from '@/lib/types'
import { TickerSearch } from '@/components/assets/TickerSearch'
import { CurrencyPicker } from '@/components/shared/CurrencyPicker'
import { getHoldingUnit, translateUnit } from '@/lib/utils'

type View = 'main' | 'acctPicker' | 'acctTypePicker' | 'acctForm' | 'assetPicker' | 'assetKindPicker' | 'assetTickerSearch' | 'assetForm'
type Mode = 'add' | 'edit'
interface Props { mode: Mode; open: boolean; onClose: () => void; holding?: Holding }

const LIQUID_ACCOUNT_TYPES: AccountType[] = ['bank', 'cash', 'e_wallet']
const LIQUID_SUBKINDS: SubKind[] = ['bank_account', 'physical_cash', 'e_wallet']

import { ACC_GROUPS, type AccTypeItem } from '@/lib/accountTypes'

interface AssetKindItem { subKind: SubKind; labelKey: string; icon: string; assetClass: AssetClass; category: Category; useTicker?: boolean }
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
    { subKind: 'physical_cash', labelKey: 'asset.subKinds.physical_cash', icon: '💵', assetClass: 'asset', category: 'liquid' },
    { subKind: 'bank_account', labelKey: 'asset.subKinds.bank_account', icon: '🏦', assetClass: 'asset', category: 'liquid' },
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
  bank_account: 'fixed', physical_cash: 'fixed', stablecoin: 'fixed',
  e_wallet: 'fixed', receivable: 'fixed', credit_card: 'fixed',
  mortgage: 'fixed', personal_loan: 'fixed',
  stock: 'market', etf: 'market', crypto: 'market',
  fund: 'manual', precious_metal: 'market', real_estate: 'manual',
  vehicle: 'manual', other: 'manual',
}

export function HoldingSidePanel({ mode, open, onClose, holding }: Props) {
  const t = useTranslations()
  const [views, setViews] = useState<View[]>(['main'])
  const currentView = views[views.length - 1]
  function pushView(v: View) { setViews(prev => [...prev, v]) }
  function popView() { setViews(prev => prev.length > 1 ? prev.slice(0, -1) : prev) }
  function resetViews() { setViews(['main']) }

  // Main form state
  const [selectedAccount, setSelectedAccount] = useState('')
  const [selectedAsset, setSelectedAsset] = useState('')
  const [quantity, setQuantity] = useState('')
  const [qtyMode, setQtyMode] = useState<'set' | 'adjust'>('set')
  const [adjustSign, setAdjustSign] = useState<'+' | '-'>('+')

  const [liquidCurrency, setLiquidCurrency] = useState('TWD')
  const [note, setNote] = useState('')

  // Account creation state
  const [pendingAccType, setPendingAccType] = useState<AccTypeItem | null>(null)
  const [newAccName, setNewAccName] = useState('')
  const [newAccInstitution, setNewAccInstitution] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)

  // Asset picker expand state
  const [expandNewAsset, setExpandNewAsset] = useState(false)

  // Asset creation state
  const [pendingAssetKind, setPendingAssetKind] = useState<AssetKindItem | null>(null)
  const [selectedTicker, setSelectedTicker] = useState<Ticker | null>(null)
  const [selectedPreciousMetal, setSelectedPreciousMetal] = useState<typeof PRECIOUS_METALS[number] | null>(null)
  const [newAssetName, setNewAssetName] = useState('')
  const [newAssetSymbol, setNewAssetSymbol] = useState('')
  const [newAssetCurrency, setNewAssetCurrency] = useState('TWD')
  const [newAssetUnit, setNewAssetUnit] = useState('公克')
  const [savingAsset, setSavingAsset] = useState(false)

  const { data: accounts, mutate: mutateAccounts } = useSWR<Account[]>(`${BASE}/accounts`, fetcher)
  const { data: assets, mutate: mutateAssets } = useSWR<Asset[]>(`${BASE}/assets`, fetcher)
  const selectedAccountObj = accounts?.find(a => a.id === selectedAccount)
  const selectedAssetObj = assets?.find(a => a.id === selectedAsset)

  const isLiquidAccount = !!(selectedAccountObj && LIQUID_ACCOUNT_TYPES.includes(selectedAccountObj.accountType))
  const isLiquidHolding = !!(holding && LIQUID_SUBKINDS.includes(holding.subKind as SubKind))

  // Sync quantity + currency when opening in edit mode
  useEffect(() => {
    if (open && holding) {
      setQuantity(holding.quantity != null ? String(Number(holding.quantity)) : '')
      setLiquidCurrency(holding.currencyCode ?? 'TWD')
    }
  }, [open, holding])

  async function handleCreateAccount() {
    if (!newAccName.trim() || !pendingAccType) return
    setSavingAccount(true)
    try {
      const res = await fetch(`${BASE}/accounts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAccName.trim(), accountType: pendingAccType.type,
          institution: newAccInstitution.trim() || undefined }),
      })
      const created: Account = await res.json()
      await mutateAccounts()
      setSelectedAccount(created.id)
      setNewAccName(''); setNewAccInstitution('')
      resetViews()
    } finally { setSavingAccount(false) }
  }

  function handleTickerSelect(ticker: Ticker) {
    setSelectedTicker(ticker)
    setPendingAssetKind(prev => prev ? { ...prev, subKind: ticker.type as SubKind } : prev)
    setNewAssetName(ticker.name)
    setNewAssetSymbol(ticker.symbol)
    setNewAssetCurrency(ticker.type === 'crypto' || ticker.country === 'US' ? 'USD' : 'TWD')
    setNewAssetUnit(ticker.type === 'crypto' ? ticker.symbol.toUpperCase() : '股')
    pushView('assetForm')
  }

  async function handleCreateAsset() {
    if (!newAssetName.trim() || !pendingAssetKind) return
    setSavingAsset(true)
    try {
      const res = await fetch(`${BASE}/assets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAssetName.trim(),
          assetClass: pendingAssetKind.assetClass,
          category: pendingAssetKind.category,
          subKind: pendingAssetKind.subKind,
          currencyCode: newAssetCurrency.trim().toUpperCase() || 'TWD',
          pricingMode: DEFAULT_PRICING[pendingAssetKind.subKind] ?? 'manual',
          symbol: newAssetSymbol.trim() || undefined,
          unit: newAssetUnit || undefined,
        }),
      })
      const created: Asset = await res.json()
      await mutateAssets()
      setSelectedAsset(created.id)
      setNewAssetName(''); setNewAssetSymbol(''); setSelectedTicker(null); setNewAssetUnit('公克')
      resetViews()
    } finally { setSavingAsset(false) }
  }

  async function handleSave() {
    const inputVal = parseFloat(quantity)
    const bal = (mode === 'edit' && qtyMode === 'adjust')
      ? Number(holding!.quantity) + (adjustSign === '-' ? -inputVal : inputVal)
      : inputVal
    if (mode === 'add' && isLiquidAccount) {
      await fetch(`${BASE}/accounts/${selectedAccount}/balance`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: bal, currencyCode: liquidCurrency }),
      })
    } else if (mode === 'edit' && isLiquidHolding) {
      await fetch(`${BASE}/accounts/${holding!.accountId}/balance`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: bal, currencyCode: liquidCurrency }),
      })
      const delta = bal - Number(holding!.quantity)
      if (delta !== 0) {
        await fetch(`${BASE}/transactions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetId: holding!.assetId, accountId: holding!.accountId,
            txnType: delta > 0 ? 'buy' : 'sell',
            quantity: Math.abs(delta),
            txnDate: new Date().toISOString().slice(0, 10),
            note: note.trim() || undefined,
          }),
        })
      }
    } else {
      const assetId = selectedAsset || holding!.assetId
      const accountId = selectedAccount || holding!.accountId
      await fetch(`${BASE}/holdings/${assetId}/${accountId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: bal }),
      })
      const prevQty = mode === 'edit' ? Number(holding!.quantity) : 0
      const delta = bal - prevQty
      if (delta !== 0) {
        const txnType = mode === 'add' ? 'buy' : delta > 0 ? 'buy' : 'sell'
        await fetch(`${BASE}/transactions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetId, accountId, txnType,
            quantity: Math.abs(delta),
            txnDate: new Date().toISOString().slice(0, 10),
            note: note.trim() || undefined,
          }),
        })
      }
    }
    if (holding) {
      globalMutate(`${BASE}/transactions?assetId=${holding.assetId}&accountId=${holding.accountId}`)
    }
    globalMutate(`${BASE}/holdings`)
    handleClose()
  }

  async function handleDelete() {
    if (!confirm(t('holdings.deleteConfirm', { name: holding!.assetName }))) return
    await fetch(`${BASE}/holdings/${holding!.assetId}/${holding!.accountId}`, { method: 'DELETE' })
    globalMutate(`${BASE}/holdings`)
    handleClose()
  }

  function handleClose() {
    resetViews()
    setSelectedAccount(''); setSelectedAsset('')
    setQuantity(''); setNote(''); setLiquidCurrency('TWD')
    setQtyMode('set')
    setAdjustSign('+')
    setSelectedTicker(null)
    setExpandNewAsset(false)
    onClose()
  }

  const canSubmit = mode === 'add'
    ? isLiquidAccount
      ? !!(selectedAccount && quantity && !isNaN(parseFloat(quantity)))
      : !!(selectedAccount && selectedAsset && quantity && parseFloat(quantity) !== 0)
    : qtyMode === 'adjust'
      ? !!(quantity && !isNaN(parseFloat(quantity)) && parseFloat(quantity) > 0)
      : !!(quantity && parseFloat(quantity) !== 0)

  const viewTitle: Record<View, string> = {
    main: mode === 'add' ? t('holdings.add') : t('holdings.edit'),
    acctPicker: t('holdings.acctPicker'),
    acctTypePicker: t('holdings.addAccountTitle'),
    acctForm: pendingAccType ? t(`account.typeLabels.${pendingAccType.type}` as Parameters<typeof t>[0]) : t('holdings.acctInfo'),
    assetPicker: t('holdings.assetPicker'),
    assetKindPicker: t('holdings.addAssetKind'),
    assetTickerSearch: pendingAssetKind?.subKind === 'crypto' ? t('assets.tickerSearch.crypto') : t('assets.tickerSearch.stockEtf'),
    assetForm: selectedTicker ? selectedTicker.name : (pendingAssetKind ? t(pendingAssetKind.labelKey as Parameters<typeof t>[0]) : t('holdings.assetInfo')),
  }

  return (
    <div className={`fixed inset-y-0 right-0 w-[440px] bg-[var(--color-surface)] shadow-2xl
      transform transition-transform duration-300 z-40 flex flex-col
      ${open ? 'translate-x-0' : 'translate-x-full'}`}>

      {/* Header */}
      <div className="flex items-center h-14 px-4 border-b border-[var(--color-border)] shrink-0">
        <button onClick={currentView === 'main' ? handleClose : popView}
          className="w-8 h-8 flex items-center justify-center rounded-full
            text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]">
          {currentView === 'main' ? '✕' : '‹'}
        </button>
        <h2 className="flex-1 text-center font-semibold text-sm">{viewTitle[currentView]}</h2>
        <div className="w-8" />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">

        {/* ── EDIT MODE ── */}
        {mode === 'edit' && holding && currentView === 'main' && (
          <div className="p-4 space-y-4">
            <div className="rounded-xl bg-[var(--color-bg)] p-4">
              <p className="font-semibold">{holding.assetName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-[var(--color-muted)]">{holding.accountName}</span>
                {holding.institution && (
                  <span className="text-sm text-[var(--color-muted)]">· {holding.institution}</span>
                )}
                <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-border)] text-[var(--color-muted)]">
                  {t(`account.types.${holding.accountType}` as Parameters<typeof t>[0], { defaultValue: holding.accountType })}
                </span>
              </div>
              {holding.latestValueInBase != null && (
                <p className="text-sm text-[var(--color-muted)] mt-1">
                  {t('holdings.estimatedValue')}{Number(holding.latestValueInBase).toLocaleString()}
                </p>
              )}
            </div>
            {/* Mode toggle */}
            <div className="flex p-1 bg-[var(--color-bg)] rounded-xl">
              <button onClick={() => { setQtyMode('set'); setQuantity(String(Number(holding.quantity))) }}
                className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors
                  ${qtyMode === 'set' ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm' : 'text-[var(--color-muted)]'}`}>
                {t('holdings.setQuantity')}
              </button>
              <button onClick={() => { setQtyMode('adjust'); setQuantity('') }}
                className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors
                  ${qtyMode === 'adjust' ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm' : 'text-[var(--color-muted)]'}`}>
                {t('holdings.adjustQuantity')}
              </button>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
              <div className="flex items-center px-4 py-3.5 border-b border-[var(--color-border)]">
                {qtyMode === 'adjust' ? (
                  <div className="flex items-center gap-1.5 mr-3">
                    <button onClick={() => setAdjustSign('+')}
                      className={`w-7 h-7 rounded-full text-sm font-bold transition-colors
                        ${adjustSign === '+' ? 'bg-green-500 text-white' : 'bg-[var(--color-border)] text-[var(--color-muted)]'}`}>
                      +
                    </button>
                    <button onClick={() => setAdjustSign('-')}
                      className={`w-7 h-7 rounded-full text-sm font-bold transition-colors
                        ${adjustSign === '-' ? 'bg-red-500 text-white' : 'bg-[var(--color-border)] text-[var(--color-muted)]'}`}>
                      −
                    </button>
                  </div>
                ) : (
                  <span className="text-sm text-[var(--color-muted)] w-16">
                    {isLiquidHolding ? t('holdings.balance') : t('holdings.quantity')}
                  </span>
                )}
                <input type="number" min="0" value={quantity} onChange={e => setQuantity(e.target.value)}
                  className="flex-1 text-right bg-transparent text-lg font-semibold outline-none" />
                <span className="ml-2 px-2 py-1 bg-[var(--color-text)] text-[var(--color-surface)]
                  rounded-full text-xs font-bold shrink-0">
                  {translateUnit(getHoldingUnit(holding), t)}
                </span>
              </div>
              {qtyMode === 'adjust' && quantity !== '' && !isNaN(parseFloat(quantity)) && parseFloat(quantity) > 0 && (
                <div className="px-4 py-2 text-xs text-[var(--color-muted)] text-right border-b border-[var(--color-border)]">
                  {t('holdings.result')}{String(Number(Number(holding.quantity) + (adjustSign === '-' ? -parseFloat(quantity) : parseFloat(quantity))))} {translateUnit(getHoldingUnit(holding), t)}
                </div>
              )}
              <div className="flex items-center px-4 py-3.5">
                <span className="text-sm text-[var(--color-muted)] w-16">{t('account.noteLabel')}</span>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder={t('common.optional')}
                  className="flex-1 text-right bg-transparent text-sm outline-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={!canSubmit}
                className="flex-1 bg-[var(--color-accent)] text-white rounded-xl py-3 font-medium disabled:opacity-40">
                {t('holdings.update')}
              </button>
              <button onClick={handleDelete}
                className="flex-1 border border-red-400 text-red-500 rounded-xl py-3">
                {t('common.delete')}
              </button>
            </div>
            <HoldingTransactions assetId={holding.assetId} accountId={holding.accountId} />
            <RecurringEntriesPanel assetId={holding.assetId} accountId={holding.accountId} />
          </div>
        )}

        {/* ── ADD MODE: MAIN ── */}
        {mode === 'add' && currentView === 'main' && (
          <div className="p-4 space-y-3">
            {/* Account selector — always first */}
            <button onClick={() => pushView('acctPicker')}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl
                bg-[var(--color-bg)] border border-[var(--color-border)]
                hover:border-[var(--color-accent)] transition-colors text-left">
              <span className="text-sm text-[var(--color-muted)]">{t('holdings.accountLabel')}</span>
              <div className="flex items-center gap-2 text-sm">
                {selectedAccountObj ? (
                  <div className="text-right">
                    <div className="font-medium">{selectedAccountObj.name}</div>
                    {selectedAccountObj.institution && (
                      <div className="text-xs text-[var(--color-muted)]">{selectedAccountObj.institution}</div>
                    )}
                  </div>
                ) : (
                  <span className="text-[var(--color-muted)]">{t('holdings.selectAccount')}</span>
                )}
                <span className="text-[var(--color-muted)] text-lg leading-none">›</span>
              </div>
            </button>

            {/* Asset selector — shown after account is chosen, only for non-liquid accounts */}
            {selectedAccount && !isLiquidAccount && (
              <button onClick={() => pushView('assetPicker')}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl
                  bg-[var(--color-bg)] border border-[var(--color-border)]
                  hover:border-[var(--color-accent)] transition-colors text-left">
                <span className="text-sm text-[var(--color-muted)]">{t('holdings.assetLabel')}</span>
                <div className="flex items-center gap-2 text-sm">
                  {selectedAssetObj ? (
                    <div className="flex items-center gap-2">
                      {selectedAssetObj.symbol && (
                        <span className="px-2 py-0.5 bg-[var(--color-text)] text-[var(--color-surface)]
                          rounded-full text-xs font-bold">
                          {selectedAssetObj.symbol}
                        </span>
                      )}
                      <span className="font-medium">{selectedAssetObj.name}</span>
                    </div>
                  ) : (
                    <span className="text-[var(--color-muted)]">{t('holdings.selectAsset')}</span>
                  )}
                  <span className="text-[var(--color-muted)] text-lg leading-none">›</span>
                </div>
              </button>
            )}

            {/* Amount card */}
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-bg)]">
              <div className="flex items-center px-4 py-4 border-b border-[var(--color-border)]">
                <span className="text-sm font-medium">
                  {isLiquidAccount ? t('holdings.balance') : t('holdings.quantity')}
                </span>
                <div className="flex-1 flex items-center justify-end gap-2">
                  <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
                    placeholder="0"
                    className="w-32 text-right bg-transparent text-2xl font-semibold outline-none" />
                  {isLiquidAccount ? (
                    <CurrencyPicker value={liquidCurrency} onChange={setLiquidCurrency} />
                  ) : selectedAssetObj && (
                    <span className="px-2 py-1 bg-[var(--color-text)] text-[var(--color-surface)]
                      rounded-full text-xs font-bold shrink-0">
                      {selectedAssetObj.symbol ?? selectedAssetObj.unit ?? selectedAssetObj.currencyCode}
                    </span>
                  )}
                </div>
              </div>
              {!isLiquidAccount && (
                <div className="flex items-center px-4 py-3.5">
                  <span className="text-sm text-[var(--color-muted)]">{t('account.noteLabel')}</span>
                  <input value={note} onChange={e => setNote(e.target.value)} placeholder={t('common.optional')}
                    className="flex-1 text-right bg-transparent text-sm outline-none" />
                </div>
              )}
            </div>

            <div className="pt-2">
              <button onClick={handleSave} disabled={!canSubmit}
                className="w-full py-3.5 bg-[var(--color-accent)] text-white rounded-xl font-medium
                  disabled:opacity-40 transition-opacity text-base">
                {isLiquidAccount ? t('holdings.setBalance') : t('holdings.createHolding')}
              </button>
            </div>
          </div>
        )}

        {/* ── ACCOUNT PICKER ── */}
        {currentView === 'acctPicker' && (
          <div className="p-4 space-y-2">
            {(accounts ?? []).length === 0 && (
              <p className="text-sm text-center text-[var(--color-muted)] py-8">
                {t('holdings.noAccounts')}
              </p>
            )}
            {(accounts ?? []).map(a => (
              <button key={a.id} onClick={() => { setSelectedAccount(a.id); popView() }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm
                  transition-colors
                  ${selectedAccount === a.id
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 font-medium'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-accent)]'}`}>
                <div className="text-left">
                  <div>{a.name}</div>
                  {a.institution && (
                    <div className="text-xs text-[var(--color-muted)]">{a.institution}</div>
                  )}
                </div>
                {selectedAccount === a.id && (
                  <span className="text-[var(--color-accent)] text-xs shrink-0">✓</span>
                )}
              </button>
            ))}
            <button onClick={() => pushView('acctTypePicker')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 mt-2 rounded-xl
                border border-dashed border-[var(--color-border)] text-[var(--color-accent)] text-sm
                hover:border-[var(--color-accent)] transition-colors">
              {t('holdings.addAccountButton')}
            </button>
          </div>
        )}

        {/* ── ACCOUNT TYPE PICKER ── */}
        {currentView === 'acctTypePicker' && (
          <div>
            {ACC_GROUPS.map(group => (
              <div key={group.groupKey}>
                <div className="px-4 py-2 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                  <span className="text-xs font-semibold tracking-wider text-[var(--color-muted)] uppercase">
                    {t(`account.groups.${group.groupKey}` as Parameters<typeof t>[0])}
                  </span>
                </div>
                {group.items.map(item => (
                  <button key={item.type}
                    onClick={() => {
                      setPendingAccType(item)
                      setNewAccName(t(`account.typeLabels.${item.type}` as Parameters<typeof t>[0]))
                      setNewAccInstitution('')
                      pushView('acctForm')
                    }}
                    className="w-full flex items-center gap-4 px-4 py-4 bg-[var(--color-surface)]
                      hover:bg-[var(--color-bg)] border-b border-[var(--color-border)] transition-colors">
                    <span className="text-xl w-8 text-center">{item.icon}</span>
                    <span className="text-sm font-medium flex-1 text-left">
                      {t(`account.typeLabels.${item.type}` as Parameters<typeof t>[0])}
                    </span>
                    <span className="text-[var(--color-muted)]">›</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── ACCOUNT FORM ── */}
        {currentView === 'acctForm' && pendingAccType && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-bg)]">
              <span className="text-2xl">{pendingAccType.icon}</span>
              <span className="font-medium text-sm">
                {t(`account.typeLabels.${pendingAccType.type}` as Parameters<typeof t>[0])}
              </span>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
              <div className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5 border-b border-[var(--color-border)]">
                <span className="text-sm text-[var(--color-muted)]">{t('holdings.acctNameLabel')}</span>
                <input value={newAccName} onChange={e => setNewAccName(e.target.value)}
                  placeholder={t('holdings.acctNamePlaceholder', { type: t(`account.typeLabels.${pendingAccType.type}` as Parameters<typeof t>[0]) })} autoFocus
                  className="text-right bg-transparent text-sm outline-none w-full" />
              </div>
              <div className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5">
                <span className="text-sm text-[var(--color-muted)]">{t('account.institutionLabel')}</span>
                <input value={newAccInstitution} autoComplete="off"
                  onChange={e => setNewAccInstitution(e.target.value)}
                  placeholder={t('account.institutionPlaceholder')}
                  className="text-right bg-transparent text-sm outline-none w-full" />
              </div>
            </div>
            <button onClick={handleCreateAccount} disabled={!newAccName.trim() || savingAccount}
              className="w-full py-3.5 bg-[var(--color-accent)] text-white rounded-xl font-medium
                disabled:opacity-40 transition-opacity">
              {savingAccount ? t('holdings.creatingAccount') : t('account.createButton')}
            </button>
          </div>
        )}

        {/* ── ASSET PICKER ── */}
        {currentView === 'assetPicker' && (
          <div>
            {/* + New Asset — inline expand */}
            <button onClick={() => setExpandNewAsset(p => !p)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5
                border-b border-[var(--color-border)] text-[var(--color-accent)] text-sm
                hover:bg-[var(--color-bg)] transition-colors font-medium">
              {expandNewAsset ? t('holdings.collapseNewAsset') : t('holdings.expandNewAsset')}
            </button>

            {expandNewAsset && (
              <div className="border-b border-[var(--color-border)]">
                {ASSET_GROUPS.map(group => (
                  <div key={group.labelKey}>
                    <div className="px-4 py-2 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                      <span className="text-xs font-semibold tracking-wider text-[var(--color-muted)] uppercase">
                        {t(group.labelKey as Parameters<typeof t>[0])}
                      </span>
                    </div>
                    {group.items.map((item, idx) => (
                      <button key={`${item.subKind}-${idx}`}
                        onClick={() => {
                          setExpandNewAsset(false)
                          setPendingAssetKind(item)
                          setSelectedTicker(null)
                          setSelectedPreciousMetal(null)
                          setNewAssetName(t(item.labelKey as Parameters<typeof t>[0]))
                          setNewAssetSymbol(''); setNewAssetCurrency('TWD'); setNewAssetUnit('公克')
                          if (item.useTicker) {
                            pushView('assetTickerSearch')
                          } else {
                            pushView('assetForm')
                          }
                        }}
                        className="w-full flex items-center gap-4 px-4 py-3.5 bg-[var(--color-surface)]
                          hover:bg-[var(--color-bg)] border-b border-[var(--color-border)] transition-colors">
                        <span className="text-lg w-7 text-center">{item.icon}</span>
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

            {/* Existing assets */}
            <div className="p-4 space-y-2">
              {(assets ?? []).length === 0 && !expandNewAsset && (
                <p className="text-sm text-center text-[var(--color-muted)] py-8">
                  {t('holdings.noAssets')}
                </p>
              )}
              {(assets ?? []).map(a => (
                <button key={a.id} onClick={() => { setSelectedAsset(a.id); popView() }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm
                    transition-colors
                    ${selectedAsset === a.id
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 font-medium'
                      : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-accent)]'}`}>
                  <span>{a.name}</span>
                  <div className="flex items-center gap-2">
                    {a.symbol && (
                      <span className="px-2 py-0.5 bg-[var(--color-text)] text-[var(--color-surface)]
                        rounded-full text-xs font-bold">
                        {a.symbol}
                      </span>
                    )}
                    <span className="text-[var(--color-muted)] text-xs">{a.currencyCode}</span>
                    {selectedAsset === a.id && (
                      <span className="text-[var(--color-accent)] text-xs">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── ASSET TICKER SEARCH ── */}
        {currentView === 'assetTickerSearch' && (
          <TickerSearch
            onSelect={handleTickerSelect}
            onBack={popView}
            defaultMarket={pendingAssetKind?.subKind === 'crypto' ? 'Crypto' : 'TW'}
          />
        )}

        {/* ── ASSET FORM ── */}
        {currentView === 'assetForm' && pendingAssetKind && (
          <div className="p-4 space-y-4">
            {selectedTicker ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-bg)]">
                <span className="text-2xl">{pendingAssetKind.icon}</span>
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
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-bg)]">
                <span className="text-2xl">{pendingAssetKind.icon}</span>
                <span className="font-medium text-sm">
                  {t(pendingAssetKind.labelKey as Parameters<typeof t>[0])}
                </span>
              </div>
            )}
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
              <div className="grid grid-cols-[4rem_1fr] items-center px-4 py-3.5 border-b border-[var(--color-border)]">
                <span className="text-sm text-[var(--color-muted)]">{t('assets.form.nameLabel')}</span>
                <input value={newAssetName} onChange={e => setNewAssetName(e.target.value)}
                  placeholder={t('assets.form.namePlaceholder')} autoFocus={!selectedTicker}
                  className="text-right bg-transparent text-sm outline-none w-full" />
              </div>
              {DEFAULT_PRICING[pendingAssetKind.subKind] === 'market' && pendingAssetKind.subKind !== 'precious_metal' && (
                <div className="grid grid-cols-[4rem_1fr] items-center px-4 py-3.5 border-b border-[var(--color-border)]">
                  <span className="text-sm text-[var(--color-muted)]">{t('assets.form.symbolLabel')}</span>
                  {selectedTicker
                    ? <span className="text-right text-sm text-[var(--color-muted)]">{newAssetSymbol}</span>
                    : <input value={newAssetSymbol} onChange={e => setNewAssetSymbol(e.target.value)}
                        placeholder={t('assets.detail.symbolPlaceholder')}
                        className="text-right bg-transparent text-sm outline-none w-full" />
                  }
                </div>
              )}
              {pendingAssetKind.subKind === 'precious_metal' && (
                <>
                  <div className="grid grid-cols-[4rem_1fr] items-center px-4 py-3.5 border-b border-[var(--color-border)]">
                    <span className="text-sm text-[var(--color-muted)]">{t('assets.form.metalLabel')}</span>
                    <div className="flex justify-end gap-2">
                      {PRECIOUS_METALS.map(m => (
                        <button key={m.symbol} type="button"
                          onClick={() => {
                            setSelectedPreciousMetal(m)
                            setNewAssetName(t(m.nameKey))
                            setNewAssetSymbol(m.symbol)
                            setNewAssetCurrency('USD')
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                            ${selectedPreciousMetal?.symbol === m.symbol
                              ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                              : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]'}`}>
                          {t(m.nameKey)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-[4rem_1fr] items-center px-4 py-3.5 border-b border-[var(--color-border)]">
                    <span className="text-sm text-[var(--color-muted)]">{t('assets.form.unitLabel')}</span>
                    <div className="flex justify-end gap-2">
                      {UNIT_OPTIONS.map(u => (
                        <button key={u.value} type="button" onClick={() => setNewAssetUnit(u.value)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                            ${newAssetUnit === u.value
                              ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                              : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]'}`}>
                          {t(u.tKey)}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {DEFAULT_PRICING[pendingAssetKind.subKind] !== 'market' && pendingAssetKind.subKind !== 'precious_metal' && (
                <div className="grid grid-cols-[4rem_1fr] items-center px-4 py-3.5">
                  <span className="text-sm text-[var(--color-muted)]">{t('assets.form.currencyLabel')}</span>
                  {selectedTicker
                    ? <span className="text-right text-sm text-[var(--color-muted)]">{newAssetCurrency}</span>
                    : <input value={newAssetCurrency}
                        onChange={e => setNewAssetCurrency(e.target.value.toUpperCase())}
                        placeholder="TWD"
                        className="text-right bg-transparent text-sm outline-none w-full" />
                  }
                </div>
              )}
            </div>
            <button onClick={handleCreateAsset} disabled={!newAssetName.trim() || savingAsset}
              className="w-full py-3.5 bg-[var(--color-accent)] text-white rounded-xl font-medium
                disabled:opacity-40 transition-opacity">
              {savingAsset ? t('holdings.creatingAsset') : t('assets.createButton')}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

function HoldingTransactions({ assetId, accountId }: { assetId: string; accountId: string }) {
  const t = useTranslations()
  const { data: txns } = useSWR<Transaction[]>(
    `${BASE}/transactions?assetId=${assetId}&accountId=${accountId}`,
    fetcher,
  )

  const sorted = txns ? [...txns].sort((a, b) => b.txnDate.localeCompare(a.txnDate)) : []
  const visible = sorted.slice(0, 10)
  const hasMore = sorted.length > 10

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
          {t('holdings.txnHistory')}
        </p>
        {hasMore && (
          <a href={`/assets/${assetId}`}
            className="text-xs text-[var(--color-accent)] hover:underline">
            {t('holdings.viewAllTxns')}
          </a>
        )}
      </div>
      {!txns || txns.length === 0
        ? <p className="text-sm text-[var(--color-muted)] text-center py-4">{t('holdings.noTxns')}</p>
        : (
          <>
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
              {visible.map((txn, i) => {
                const isPositive = txn.txnType === 'buy' || txn.txnType === 'transfer_in'
                return (
                  <div key={txn.id}
                    className={`flex items-center justify-between pl-3 pr-4 py-3 text-sm border-l-2
                      ${isPositive ? 'border-l-green-500' : 'border-l-red-500'}
                      ${i < visible.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}>
                    <div>
                      <span className="text-[var(--color-muted)] text-xs">{txn.txnDate}</span>
                      {txn.note && <p className="text-xs text-[var(--color-muted)] mt-0.5">{txn.note}</p>}
                    </div>
                    <span className={`font-medium tabular-nums ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                      {isPositive ? '+' : '−'}
                      {Number(txn.quantity).toLocaleString('zh-TW', { maximumFractionDigits: 8 })}
                    </span>
                  </div>
                )
              })}
            </div>
            {hasMore && (
              <p className="text-xs text-[var(--color-muted)] text-center mt-2">
                {t('holdings.showingRecent', { total: sorted.length })} ·{' '}
                <a href={`/assets/${assetId}`} className="text-[var(--color-accent)] hover:underline">
                  {t('holdings.viewAllTxns')}
                </a>
              </p>
            )}
          </>
        )
      }
    </div>
  )
}
