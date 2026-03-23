'use client'
import { useState, useEffect } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { BASE, fetcher } from '@/lib/api'
import type { Account, AccountType, Asset, AssetClass, Category, Holding, PricingMode, SubKind, Ticker, Transaction } from '@/lib/types'
import { TickerSearch } from '@/components/assets/TickerSearch'
import { CurrencyPicker } from '@/components/shared/CurrencyPicker'
import { getHoldingUnit } from '@/lib/utils'

type View = 'main' | 'acctPicker' | 'acctTypePicker' | 'acctForm' | 'assetPicker' | 'assetKindPicker' | 'assetTickerSearch' | 'assetForm'
type Mode = 'add' | 'edit'
interface Props { mode: Mode; open: boolean; onClose: () => void; holding?: Holding }

const LIQUID_ACCOUNT_TYPES: AccountType[] = ['bank', 'cash', 'e_wallet']
const LIQUID_SUBKINDS: SubKind[] = ['bank_account', 'physical_cash', 'e_wallet']

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

interface AssetKindItem { subKind: SubKind; label: string; icon: string; assetClass: AssetClass; category: Category; useTicker?: boolean }
interface AssetGroup { label: string; colorClass: string; items: AssetKindItem[] }
const ASSET_GROUPS: AssetGroup[] = [
  { label: '流動資金', colorClass: 'bg-green-500', items: [
    { subKind: 'physical_cash', label: '現金', icon: '💵', assetClass: 'asset', category: 'liquid' },
    { subKind: 'bank_account', label: '銀行存款', icon: '🏦', assetClass: 'asset', category: 'liquid' },
    { subKind: 'e_wallet', label: '電子錢包', icon: '📲', assetClass: 'asset', category: 'liquid' },
  ]},
  { label: '投資', colorClass: 'bg-indigo-500', items: [
    { subKind: 'stock', label: '股票/ETF', icon: '📊', assetClass: 'asset', category: 'investment', useTicker: true },
    { subKind: 'fund', label: '基金', icon: '💰', assetClass: 'asset', category: 'investment' },
    { subKind: 'crypto', label: '加密貨幣', icon: '₿', assetClass: 'asset', category: 'investment', useTicker: true },
    { subKind: 'stablecoin', label: '穩定幣', icon: '💲', assetClass: 'asset', category: 'investment' },
    { subKind: 'precious_metal', label: '實體貴金屬', icon: '🥇', assetClass: 'asset', category: 'investment' },
    { subKind: 'other', label: '其他投資', icon: '📦', assetClass: 'asset', category: 'investment' },
  ]},
  { label: '固定資產', colorClass: 'bg-violet-500', items: [
    { subKind: 'real_estate', label: '不動產', icon: '🏠', assetClass: 'asset', category: 'fixed' },
    { subKind: 'vehicle', label: '車輛', icon: '🚗', assetClass: 'asset', category: 'fixed' },
    { subKind: 'other', label: '其他', icon: '📦', assetClass: 'asset', category: 'fixed' },
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

const ACCT_TYPE_LABELS: Record<string, string> = {
  bank: '銀行', broker: '券商', crypto_exchange: '加密貨幣交易所',
  e_wallet: '電子錢包', cash: '現金', other: '其他',
}

const DEFAULT_PRICING: Record<string, PricingMode> = {
  bank_account: 'fixed', physical_cash: 'fixed', stablecoin: 'fixed',
  e_wallet: 'fixed', receivable: 'fixed', credit_card: 'fixed',
  mortgage: 'fixed', personal_loan: 'fixed',
  stock: 'market', etf: 'market', crypto: 'market',
  fund: 'manual', precious_metal: 'manual', real_estate: 'manual',
  vehicle: 'manual', other: 'manual',
}

export function HoldingSidePanel({ mode, open, onClose, holding }: Props) {
  const [views, setViews] = useState<View[]>(['main'])
  const currentView = views[views.length - 1]
  function pushView(v: View) { setViews(prev => [...prev, v]) }
  function popView() { setViews(prev => prev.length > 1 ? prev.slice(0, -1) : prev) }
  function resetViews() { setViews(['main']) }

  // Main form state
  const [selectedAccount, setSelectedAccount] = useState('')
  const [selectedAsset, setSelectedAsset] = useState('')
  const [quantity, setQuantity] = useState('')
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
      setQuantity(holding.quantity?.toString() ?? '')
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

  function handleTickerSelect(t: Ticker) {
    setSelectedTicker(t)
    setPendingAssetKind(prev => prev ? { ...prev, subKind: t.type as SubKind } : prev)
    setNewAssetName(t.name)
    setNewAssetSymbol(t.symbol)
    setNewAssetCurrency(t.type === 'crypto' || t.country === 'US' ? 'USD' : 'TWD')
    setNewAssetUnit(t.type === 'crypto' ? t.symbol.toUpperCase() : '股')
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
    const bal = parseFloat(quantity)
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
      // Always create a transaction record for quantity changes
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
    onClose()
  }

  async function handleDelete() {
    if (!confirm(`確認刪除「${holding!.assetName}」的持倉？此操作無法復原。`)) return
    await fetch(`${BASE}/holdings/${holding!.assetId}/${holding!.accountId}`, { method: 'DELETE' })
    globalMutate(`${BASE}/holdings`)
    onClose()
  }

  function handleClose() {
    resetViews()
    setSelectedAccount(''); setSelectedAsset('')
    setQuantity(''); setNote(''); setLiquidCurrency('TWD')
    setSelectedTicker(null)
    setExpandNewAsset(false)
    onClose()
  }

  const knownInstitutions = Array.from(
    new Set((accounts ?? []).map(a => a.institution).filter(Boolean) as string[])
  )

  const canSubmit = mode === 'add'
    ? isLiquidAccount
      ? !!(selectedAccount && quantity && !isNaN(parseFloat(quantity)))
      : !!(selectedAccount && selectedAsset && quantity && parseFloat(quantity) !== 0)
    : !!(quantity && parseFloat(quantity) !== 0)

  const viewTitle: Record<View, string> = {
    main: mode === 'add' ? '新增持倉' : '編輯持倉',
    acctPicker: '選擇帳戶',
    acctTypePicker: '新增帳戶',
    acctForm: pendingAccType?.label ?? '帳戶資訊',
    assetPicker: '選擇資產',
    assetKindPicker: '新增資產',
    assetTickerSearch: pendingAssetKind?.subKind === 'crypto' ? '搜尋加密貨幣' : '搜尋股票/ETF',
    assetForm: selectedTicker ? selectedTicker.name : (pendingAssetKind?.label ?? '資產資訊'),
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
                  {ACCT_TYPE_LABELS[holding.accountType] ?? holding.accountType}
                </span>
              </div>
              {holding.latestValueInBase != null && (
                <p className="text-sm text-[var(--color-muted)] mt-1">
                  估值：{Number(holding.latestValueInBase).toLocaleString()}
                </p>
              )}
            </div>
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
              <div className="flex items-center px-4 py-3.5 border-b border-[var(--color-border)]">
                <span className="text-sm text-[var(--color-muted)] w-16">
                  {isLiquidHolding ? '餘額' : '數量'}
                </span>
                <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
                  className="flex-1 text-right bg-transparent text-lg font-semibold outline-none" />
                <span className="ml-2 px-2 py-1 bg-[var(--color-text)] text-[var(--color-surface)]
                  rounded-full text-xs font-bold shrink-0">
                  {getHoldingUnit(holding)}
                </span>
              </div>
              <div className="flex items-center px-4 py-3.5">
                <span className="text-sm text-[var(--color-muted)] w-16">備註</span>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="選填"
                  className="flex-1 text-right bg-transparent text-sm outline-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={!canSubmit}
                className="flex-1 bg-[var(--color-accent)] text-white rounded-xl py-3 font-medium disabled:opacity-40">
                更新
              </button>
              <button onClick={handleDelete}
                className="flex-1 border border-red-400 text-red-500 rounded-xl py-3">
                刪除
              </button>
            </div>
            <HoldingTransactions assetId={holding.assetId} accountId={holding.accountId} />
          </div>
        )}

        {/* ── ADD MODE: MAIN ── */}
        {mode === 'add' && currentView === 'main' && (
          <div className="p-4 space-y-3">
            {/* Asset selector — hidden for liquid accounts */}
            {!isLiquidAccount && (
              <button onClick={() => pushView('assetPicker')}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl
                  bg-[var(--color-bg)] border border-[var(--color-border)]
                  hover:border-[var(--color-accent)] transition-colors text-left">
                <span className="text-sm text-[var(--color-muted)]">資產</span>
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
                    <span className="text-[var(--color-muted)]">選擇資產</span>
                  )}
                  <span className="text-[var(--color-muted)] text-lg leading-none">›</span>
                </div>
              </button>
            )}

            {/* Account selector */}
            <button onClick={() => pushView('acctPicker')}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl
                bg-[var(--color-bg)] border border-[var(--color-border)]
                hover:border-[var(--color-accent)] transition-colors text-left">
              <span className="text-sm text-[var(--color-muted)]">帳戶</span>
              <div className="flex items-center gap-2 text-sm">
                {selectedAccountObj ? (
                  <div className="text-right">
                    <div className="font-medium">{selectedAccountObj.name}</div>
                    {selectedAccountObj.institution && (
                      <div className="text-xs text-[var(--color-muted)]">{selectedAccountObj.institution}</div>
                    )}
                  </div>
                ) : (
                  <span className="text-[var(--color-muted)]">選擇帳戶</span>
                )}
                <span className="text-[var(--color-muted)] text-lg leading-none">›</span>
              </div>
            </button>

            {/* Amount card */}
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-bg)]">
              <div className="flex items-center px-4 py-4 border-b border-[var(--color-border)]">
                <span className="text-sm font-medium">
                  {isLiquidAccount ? '餘額' : '數量'}
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
                  <span className="text-sm text-[var(--color-muted)]">備註</span>
                  <input value={note} onChange={e => setNote(e.target.value)} placeholder="選填"
                    className="flex-1 text-right bg-transparent text-sm outline-none" />
                </div>
              )}
            </div>

            <div className="pt-2">
              <button onClick={handleSave} disabled={!canSubmit}
                className="w-full py-3.5 bg-[var(--color-accent)] text-white rounded-xl font-medium
                  disabled:opacity-40 transition-opacity text-base">
                {isLiquidAccount ? '設定餘額' : '建立持倉'}
              </button>
            </div>
          </div>
        )}

        {/* ── ACCOUNT PICKER ── */}
        {currentView === 'acctPicker' && (
          <div className="p-4 space-y-2">
            {(accounts ?? []).length === 0 && (
              <p className="text-sm text-center text-[var(--color-muted)] py-8">
                尚無帳戶，點下方建立第一個帳戶
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
              ＋ 新增帳戶
            </button>
          </div>
        )}

        {/* ── ACCOUNT TYPE PICKER (Percento style) ── */}
        {currentView === 'acctTypePicker' && (
          <div>
            {ACC_GROUPS.map(group => (
              <div key={group.label}>
                <div className="px-4 py-2 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                  <span className="text-xs font-semibold tracking-wider text-[var(--color-muted)] uppercase">
                    {group.label}</span>
                </div>
                {group.items.map(item => (
                  <button key={item.type}
                    onClick={() => {
                      setPendingAccType(item)
                      setNewAccName(item.label)
                      setNewAccInstitution('')
                      pushView('acctForm')
                    }}
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

        {/* ── ACCOUNT FORM ── */}
        {currentView === 'acctForm' && pendingAccType && (
          <div className="p-4 space-y-4">
            <datalist id="known-institutions">
              {knownInstitutions.map(i => <option key={i} value={i} />)}
            </datalist>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-bg)]">
              <span className="text-2xl">{pendingAccType.icon}</span>
              <span className="font-medium text-sm">{pendingAccType.label}</span>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
              <div className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5 border-b border-[var(--color-border)]">
                <span className="text-sm text-[var(--color-muted)]">帳戶名稱</span>
                <input value={newAccName} onChange={e => setNewAccName(e.target.value)}
                  placeholder={`例：我的${pendingAccType.label}`} autoFocus
                  className="text-right bg-transparent text-sm outline-none w-full" />
              </div>
              <div className="grid grid-cols-[5rem_1fr] items-center px-4 py-3.5">
                <span className="text-sm text-[var(--color-muted)]">機構</span>
                <input list="known-institutions" value={newAccInstitution}
                  onChange={e => setNewAccInstitution(e.target.value)}
                  placeholder="選填（例：玉山銀行）"
                  className="text-right bg-transparent text-sm outline-none w-full" />
              </div>
            </div>
            <button onClick={handleCreateAccount} disabled={!newAccName.trim() || savingAccount}
              className="w-full py-3.5 bg-[var(--color-accent)] text-white rounded-xl font-medium
                disabled:opacity-40 transition-opacity">
              {savingAccount ? '建立中…' : '建立帳戶'}
            </button>
          </div>
        )}

        {/* ── ASSET PICKER ── */}
        {currentView === 'assetPicker' && (
          <div>
            {/* ＋ 新增資產 — inline expand */}
            <button onClick={() => setExpandNewAsset(p => !p)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5
                border-b border-[var(--color-border)] text-[var(--color-accent)] text-sm
                hover:bg-[var(--color-bg)] transition-colors font-medium">
              {expandNewAsset ? '－ 收起' : '＋ 新增資產'}
            </button>

            {expandNewAsset && (
              <div className="border-b border-[var(--color-border)]">
                {ASSET_GROUPS.map(group => (
                  <div key={group.label}>
                    <div className="px-4 py-2 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                      <span className="text-xs font-semibold tracking-wider text-[var(--color-muted)] uppercase">
                        {group.label}
                      </span>
                    </div>
                    {group.items.map((item, idx) => (
                      <button key={`${item.subKind}-${idx}`}
                        onClick={() => {
                          setExpandNewAsset(false)
                          setPendingAssetKind(item)
                          setSelectedTicker(null)
                          setNewAssetName(item.label)
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

            {/* Existing assets */}
            <div className="p-4 space-y-2">
              {(assets ?? []).length === 0 && !expandNewAsset && (
                <p className="text-sm text-center text-[var(--color-muted)] py-8">
                  尚無資產，點上方「＋ 新增資產」建立
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
                    {selectedTicker.type === 'etf' ? 'ETF' : selectedTicker.type === 'crypto' ? '加密貨幣' : '股票'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-bg)]">
                <span className="text-2xl">{pendingAssetKind.icon}</span>
                <span className="font-medium text-sm">{pendingAssetKind.label}</span>
              </div>
            )}
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
              <div className="grid grid-cols-[4rem_1fr] items-center px-4 py-3.5 border-b border-[var(--color-border)]">
                <span className="text-sm text-[var(--color-muted)]">名稱</span>
                <input value={newAssetName} onChange={e => setNewAssetName(e.target.value)}
                  placeholder="例：台積電" autoFocus={!selectedTicker}
                  className="text-right bg-transparent text-sm outline-none w-full" />
              </div>
              {DEFAULT_PRICING[pendingAssetKind.subKind] === 'market' && (
                <div className="grid grid-cols-[4rem_1fr] items-center px-4 py-3.5 border-b border-[var(--color-border)]">
                  <span className="text-sm text-[var(--color-muted)]">代號</span>
                  {selectedTicker
                    ? <span className="text-right text-sm text-[var(--color-muted)]">{newAssetSymbol}</span>
                    : <input value={newAssetSymbol} onChange={e => setNewAssetSymbol(e.target.value)}
                        placeholder="例：2330.TW"
                        className="text-right bg-transparent text-sm outline-none w-full" />
                  }
                </div>
              )}
              <div className={`grid grid-cols-[4rem_1fr] items-center px-4 py-3.5
                ${pendingAssetKind.subKind === 'precious_metal' ? 'border-b border-[var(--color-border)]' : ''}`}>
                <span className="text-sm text-[var(--color-muted)]">幣別</span>
                {selectedTicker
                  ? <span className="text-right text-sm text-[var(--color-muted)]">{newAssetCurrency}</span>
                  : <input value={newAssetCurrency}
                      onChange={e => setNewAssetCurrency(e.target.value.toUpperCase())}
                      placeholder="TWD"
                      className="text-right bg-transparent text-sm outline-none w-full" />
                }
              </div>
              {pendingAssetKind.subKind === 'precious_metal' && (
                <div className="grid grid-cols-[4rem_1fr] items-center px-4 py-3.5">
                  <span className="text-sm text-[var(--color-muted)]">單位</span>
                  <div className="flex justify-end gap-2">
                    {['公克', '盎司'].map(u => (
                      <button key={u} onClick={() => setNewAssetUnit(u)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                          ${newAssetUnit === u
                            ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                            : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]'}`}>
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleCreateAsset} disabled={!newAssetName.trim() || savingAsset}
              className="w-full py-3.5 bg-[var(--color-accent)] text-white rounded-xl font-medium
                disabled:opacity-40 transition-opacity">
              {savingAsset ? '建立中…' : '建立資產'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

const TXN_TYPE_LABELS: Record<string, string> = {
  buy: '買入', sell: '賣出', transfer_in: '轉入', transfer_out: '轉出', adjustment: '調整',
}

function HoldingTransactions({ assetId, accountId }: { assetId: string; accountId: string }) {
  const { data: txns } = useSWR<Transaction[]>(
    `${BASE}/transactions?assetId=${assetId}&accountId=${accountId}`,
    fetcher,
  )

  return (
    <div className="pt-2">
      <p className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-2">交易紀錄</p>
      {!txns || txns.length === 0
        ? <p className="text-sm text-[var(--color-muted)] text-center py-4">尚無交易紀錄</p>
        : (
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
            {[...txns].sort((a, b) => b.txnDate.localeCompare(a.txnDate)).map((t, i, arr) => (
              <div key={t.id}
                className={`flex items-center justify-between px-4 py-3 text-sm
                  ${i < arr.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}>
                <div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full mr-2
                    ${t.txnType === 'buy' || t.txnType === 'transfer_in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {TXN_TYPE_LABELS[t.txnType] ?? t.txnType}
                  </span>
                  <span className="text-[var(--color-muted)] text-xs">{t.txnDate}</span>
                  {t.note && <p className="text-xs text-[var(--color-muted)] mt-0.5">{t.note}</p>}
                </div>
                <span className="font-medium tabular-nums">
                  {t.txnType === 'sell' || t.txnType === 'transfer_out' ? '−' : '+'}
                  {Number(t.quantity).toLocaleString('zh-TW', { maximumFractionDigits: 8 })}
                </span>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}
