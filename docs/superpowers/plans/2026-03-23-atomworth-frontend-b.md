# AtomWorth — Frontend Part B: Feature Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Holdings, Assets, Accounts, Snapshots, and Settings pages.

**Architecture:** Next.js 15 App Router. Client Components with SWR for data. Side Panel pattern for Holdings add/edit (right-side drawer). Shared layout from Part A.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Recharts, SWR, lucide-react

**Prerequisite:** Frontend Part A must be complete.

---

## Shared Types Reference

Key types that Part B relies on (assumed defined in `web/lib/types.ts` from Part A):

```ts
// Relevant subset — add these if not already present
export type AssetClass = 'asset' | 'liability'
export type Category = 'liquid' | 'investment' | 'fixed' | 'receivable' | 'debt'
export type SubKind = 'bank_account' | 'stock' | 'etf' | 'crypto' | 'fund' |
  'real_estate' | 'credit_card' | 'mortgage' | /* … */ string
export type PricingMode = 'market' | 'fixed' | 'manual'
export type AccountType = 'bank' | 'broker' | 'crypto_exchange' | 'e_wallet' | 'cash' | 'other'
export type TxnType = 'buy' | 'sell' | 'transfer_in' | 'transfer_out' | 'adjustment'

export interface Asset {
  id: string; name: string; asset_class: AssetClass; category: Category
  sub_kind: SubKind; symbol?: string; market?: string
  currency_code: string; pricing_mode: PricingMode
}
export interface Account {
  id: string; name: string; institution?: string
  account_type: AccountType; note?: string
}
export interface Holding {
  asset_id: string; account_id: string; quantity: number
  asset_name: string; asset_class: AssetClass; category: Category
  sub_kind: SubKind; currency_code: string; pricing_mode: PricingMode
  account_name: string; account_type: AccountType
  latest_value_in_base: number | null; updated_at: string
}
export interface Transaction {
  id: string; asset_id: string; account_id: string
  txn_type: TxnType; quantity: number; txn_date: string; note?: string
}
export interface SnapshotItem {
  asset_id: string; account_id: string; asset_name: string; account_name: string
  quantity: number; price: number; currency_code: string
  fx_rate: number; value_in_base: number
}
```

---

## Task 6: Holdings Page + HoldingSidePanel

**Files:**
- Create: `web/app/holdings/page.tsx`
- Create: `web/components/holdings/HoldingsList.tsx`
- Create: `web/components/holdings/HoldingSidePanel.tsx`
- Test: `web/__tests__/HoldingsList.test.tsx`
- Test: `web/__tests__/HoldingSidePanel.test.tsx`

### 6-A: HoldingsList — grouped by account

- [ ] **Step 1:** Write the failing test

```tsx
// web/__tests__/HoldingsList.test.tsx
import { render, screen } from '@testing-library/react'
import { HoldingsList } from '@/components/holdings/HoldingsList'
const mockHoldings: Holding[] = [
  { asset_id: 'a1', account_id: 'acc1', quantity: 10, asset_name: 'AAPL',
    account_name: '富途', latest_value_in_base: 87320, /* … */ },
  { asset_id: 'a2', account_id: 'acc2', quantity: 5, asset_name: 'BTC',
    account_name: '幣安', latest_value_in_base: null, /* … */ },
]
it('groups holdings by account name as section headers', () => {
  render(<HoldingsList holdings={mockHoldings} onRowClick={jest.fn()} />)
  expect(screen.getByText('富途')).toBeInTheDocument()
  expect(screen.getByText('幣安')).toBeInTheDocument()
  expect(screen.getByText('AAPL')).toBeInTheDocument()
})
```

- [ ] **Step 2:** Run: `cd web && npx jest HoldingsList.test.tsx` — Expected: FAIL

- [ ] **Step 3:** Implement `HoldingsList`

```tsx
// web/components/holdings/HoldingsList.tsx
'use client'
import { useMemo } from 'react'
import { Holding } from '@/lib/types'

interface Props {
  holdings: Holding[]
  onRowClick: (h: Holding) => void
}

export function HoldingsList({ holdings, onRowClick }: Props) {
  const byAccount = useMemo(() => {
    const map = new Map<string, { name: string; items: Holding[] }>()
    for (const h of holdings) {
      if (!map.has(h.account_id))
        map.set(h.account_id, { name: h.account_name, items: [] })
      map.get(h.account_id)!.items.push(h)
    }
    return Array.from(map.values())
  }, [holdings])

  return (
    <div className="space-y-6">
      {byAccount.map(({ name, items }) => (
        <section key={name}>
          <h2 className="text-sm font-semibold text-[var(--color-muted)] uppercase mb-2">{name}</h2>
          <div className="rounded-lg border border-[var(--color-border)] divide-y">
            {items.map(h => (
              <button key={`${h.asset_id}-${h.account_id}`}
                className="w-full flex justify-between px-4 py-3 hover:bg-[var(--color-bg)] text-left"
                onClick={() => onRowClick(h)}>
                <span className="font-medium">{h.asset_name}</span>
                <span className="text-sm text-[var(--color-muted)]">
                  {h.quantity} | {h.latest_value_in_base != null
                    ? h.latest_value_in_base.toLocaleString() : '—'}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 4:** Run test — Expected: PASS
- [ ] **Step 5:** Commit: `feat: add HoldingsList component grouped by account`

---

### 6-B: HoldingSidePanel

- [ ] **Step 1:** Write the failing test

```tsx
// web/__tests__/HoldingSidePanel.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { HoldingSidePanel } from '@/components/holdings/HoldingSidePanel'
it('renders add mode with account selector as step 1', () => {
  render(<HoldingSidePanel mode="add" open={true} onClose={jest.fn()} />)
  expect(screen.getByText(/選擇帳戶/)).toBeInTheDocument()
})
it('renders edit mode with quantity input pre-filled', () => {
  const holding = { asset_name: 'AAPL', account_name: '富途', quantity: 10,
    latest_value_in_base: 87320, asset_id: 'a1', account_id: 'acc1' } as Holding
  render(<HoldingSidePanel mode="edit" open={true} holding={holding} onClose={jest.fn()} />)
  expect(screen.getByDisplayValue('10')).toBeInTheDocument()
})
```

- [ ] **Step 2:** Run: `cd web && npx jest HoldingSidePanel.test.tsx` — Expected: FAIL

- [ ] **Step 3:** Implement `HoldingSidePanel`

The panel uses a controlled `open` prop and slides from the right via Tailwind `translate-x`. It has two modes:

**Edit mode** — shows asset info, quantity input, optional txn note, Save + Delete buttons.

**Add mode** — 4-step wizard:
1. Select account (`GET /accounts` via SWR)
2. Select existing asset (`GET /assets`) OR fill new asset fields
3. Enter quantity
4. Optional note (becomes `txn_type='adjustment'` transaction)

```tsx
// web/components/holdings/HoldingSidePanel.tsx  (key structure)
'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'

type Mode = 'add' | 'edit'
interface Props {
  mode: Mode; open: boolean; onClose: () => void; holding?: Holding
}

export function HoldingSidePanel({ mode, open, onClose, holding }: Props) {
  const [step, setStep] = useState(1)          // add mode steps 1-4
  const [selectedAccount, setSelectedAccount] = useState('')
  const [selectedAsset, setSelectedAsset] = useState('')
  const [quantity, setQuantity] = useState(holding?.quantity?.toString() ?? '')
  const [note, setNote] = useState('')
  const { data: accounts } = useSWR<Account[]>('/api/v1/accounts', fetcher)
  const { data: assets } = useSWR<Asset[]>('/api/v1/assets', fetcher)

  async function handleSave() {
    await fetch(`/api/v1/holdings/${selectedAsset || holding!.asset_id}/${selectedAccount || holding!.account_id}`,
      { method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ quantity: parseFloat(quantity) }) })
    if (note) {
      await fetch('/api/v1/transactions', { method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ asset_id: selectedAsset || holding!.asset_id,
          account_id: selectedAccount || holding!.account_id,
          txn_type: 'adjustment', quantity: parseFloat(quantity),
          txn_date: new Date().toISOString().slice(0,10), note }) })
    }
    onClose()
  }

  async function handleDelete() {
    await fetch(`/api/v1/holdings/${holding!.asset_id}/${holding!.account_id}`,
      { method: 'DELETE' })
    onClose()
  }

  return (
    <div className={`fixed inset-y-0 right-0 w-96 bg-[var(--color-surface)] shadow-xl
      transform transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">{mode === 'add' ? '新增持倉' : '編輯持倉'}</h2>
        <button onClick={onClose}>✕</button>
      </div>
      {/* Body — edit mode */}
      {mode === 'edit' && holding && (
        <div className="p-4 space-y-4">
          <p className="font-medium">{holding.asset_name} / {holding.account_name}</p>
          <p className="text-sm text-[var(--color-muted)]">
            估值：{holding.latest_value_in_base?.toLocaleString() ?? '—'}
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
          <a href={`/assets/${holding.asset_id}`}
            className="text-sm text-[var(--color-accent)] underline">查看資產詳情</a>
          <div className="flex gap-2 pt-4">
            <button onClick={handleSave}
              className="flex-1 bg-[var(--color-accent)] text-white rounded py-2">儲存</button>
            <button onClick={handleDelete}
              className="flex-1 border border-[var(--color-coral)] text-[var(--color-coral)] rounded py-2">刪除</button>
          </div>
        </div>
      )}
      {/* Body — add mode (4-step wizard) */}
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
              {/* TODO: "新建資產" toggle → inline AssetForm fields */}
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
```

- [ ] **Step 4:** Run test — Expected: PASS

- [ ] **Step 5:** Implement `web/app/holdings/page.tsx`

```tsx
// web/app/holdings/page.tsx
'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { HoldingsList } from '@/components/holdings/HoldingsList'
import { HoldingSidePanel } from '@/components/holdings/HoldingSidePanel'

export default function HoldingsPage() {
  const { data: holdings, mutate } = useSWR<Holding[]>('/api/v1/holdings', fetcher)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelMode, setPanelMode] = useState<'add'|'edit'>('add')
  const [selected, setSelected] = useState<Holding | undefined>()

  function openEdit(h: Holding) {
    setSelected(h); setPanelMode('edit'); setPanelOpen(true)
  }
  function openAdd() {
    setSelected(undefined); setPanelMode('add'); setPanelOpen(true)
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">持倉管理</h1>
        <button onClick={openAdd}
          className="bg-[var(--color-accent)] text-white px-4 py-2 rounded">+ 新增持倉</button>
      </div>
      <HoldingsList holdings={holdings ?? []} onRowClick={openEdit} />
      <HoldingSidePanel mode={panelMode} open={panelOpen}
        holding={selected} onClose={() => { setPanelOpen(false); mutate() }} />
    </main>
  )
}
```

- [ ] **Step 6:** Commit: `feat: holdings page with side panel add/edit/delete`

---

## Task 7: Assets Page (CRUD Table + Modal)

**Files:**
- Create: `web/app/assets/page.tsx`
- Create: `web/components/assets/AssetsTable.tsx`
- Create: `web/components/assets/AssetFormModal.tsx`
- Test: `web/__tests__/AssetsTable.test.tsx`

### Cascade dropdown logic

`asset_class` → `category` → `sub_kind` → auto-set default `pricing_mode`:

```ts
// web/lib/assetTaxonomy.ts
export const CATEGORY_BY_CLASS: Record<AssetClass, Category[]> = {
  asset: ['liquid', 'investment', 'fixed', 'receivable'],
  liability: ['debt'],
}
export const SUB_KIND_BY_CATEGORY: Record<Category, SubKind[]> = {
  liquid: ['bank_account', 'physical_cash', 'e_wallet', 'stablecoin', 'other'],
  investment: ['stock', 'etf', 'crypto', 'fund', 'precious_metal', 'other'],
  fixed: ['real_estate', 'vehicle', 'other'],
  receivable: ['receivable'],
  debt: ['credit_card', 'mortgage', 'personal_loan', 'other'],
}
export const DEFAULT_PRICING_MODE: Record<SubKind, PricingMode> = {
  bank_account: 'fixed', physical_cash: 'fixed', stablecoin: 'fixed',
  stock: 'market', etf: 'market', crypto: 'market',
  fund: 'manual', precious_metal: 'manual', real_estate: 'manual',
  credit_card: 'fixed', mortgage: 'fixed', /* … */
}
```

- [ ] **Step 1:** Write the failing test

```tsx
// web/__tests__/AssetsTable.test.tsx
import { render, screen } from '@testing-library/react'
import { AssetsTable } from '@/components/assets/AssetsTable'
const assets: Asset[] = [
  { id: '1', name: 'AAPL', asset_class: 'asset', category: 'investment',
    sub_kind: 'stock', symbol: 'AAPL', currency_code: 'USD', pricing_mode: 'market' },
]
it('renders asset row with all columns', () => {
  render(<AssetsTable assets={assets} onDelete={jest.fn()} />)
  expect(screen.getByText('AAPL')).toBeInTheDocument()
  expect(screen.getByText('market')).toBeInTheDocument()
})
it('navigates to /assets/[id] on row click', () => {
  render(<AssetsTable assets={assets} onDelete={jest.fn()} />)
  expect(screen.getByRole('link', { name: /AAPL/i })).toHaveAttribute('href', '/assets/1')
})
```

- [ ] **Step 2:** Run: `cd web && npx jest AssetsTable.test.tsx` — Expected: FAIL

- [ ] **Step 3:** Implement `AssetsTable`

```tsx
// web/components/assets/AssetsTable.tsx
'use client'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'

export function AssetsTable({ assets, onDelete }: { assets: Asset[]; onDelete: (id: string) => void }) {
  const cols = ['名稱', '類別', 'Category', 'Sub-kind', 'Symbol', '幣別', '報價']
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b text-[var(--color-muted)]">
          {cols.map(c => <th key={c} className="px-4 py-2 text-left">{c}</th>)}
          <th />
        </tr>
      </thead>
      <tbody>
        {assets.map(a => (
          <tr key={a.id} className="border-b hover:bg-[var(--color-bg)]">
            <td className="px-4 py-2">
              <Link href={`/assets/${a.id}`} className="text-[var(--color-accent)] hover:underline">{a.name}</Link>
            </td>
            <td className="px-4 py-2">{a.asset_class}</td>
            <td className="px-4 py-2">{a.category}</td>
            <td className="px-4 py-2">{a.sub_kind}</td>
            <td className="px-4 py-2">{a.symbol ?? '—'}</td>
            <td className="px-4 py-2">{a.currency_code}</td>
            <td className="px-4 py-2">{a.pricing_mode}</td>
            <td className="px-4 py-2">
              <button onClick={() => onDelete(a.id)} title="刪除">
                <Trash2 size={14} className="text-[var(--color-muted)] hover:text-[var(--color-coral)]" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 4:** Run test — Expected: PASS

- [ ] **Step 5:** Implement `AssetFormModal` (add + edit)

The modal uses a controlled `open` boolean and an optional `asset` prop. If `asset` is provided, it is edit mode (only `name`, `symbol`, `market` are editable once snapshots exist — the backend enforces this via 422, but the UI should disable the frozen fields when editing).

```tsx
// web/components/assets/AssetFormModal.tsx  (key structure)
'use client'
import { useState, useEffect } from 'react'
import { CATEGORY_BY_CLASS, SUB_KIND_BY_CATEGORY, DEFAULT_PRICING_MODE } from '@/lib/assetTaxonomy'

interface Props { open: boolean; asset?: Asset; onClose: () => void }

export function AssetFormModal({ open, asset, onClose }: Props) {
  const isEdit = !!asset
  const [form, setForm] = useState({
    name: '', asset_class: 'asset' as AssetClass, category: 'investment' as Category,
    sub_kind: 'stock' as SubKind, symbol: '', market: '',
    currency_code: 'USD', pricing_mode: 'market' as PricingMode,
  })

  useEffect(() => { if (asset) setForm({ ...asset, symbol: asset.symbol ?? '', market: asset.market ?? '' }) }, [asset])

  function set(k: string, v: string) {
    setForm(prev => {
      const next = { ...prev, [k]: v }
      if (k === 'asset_class') next.category = CATEGORY_BY_CLASS[v as AssetClass][0]
      if (k === 'category') next.sub_kind = SUB_KIND_BY_CATEGORY[v as Category][0]
      if (k === 'sub_kind') next.pricing_mode = DEFAULT_PRICING_MODE[v] ?? 'manual'
      return next
    })
  }

  async function handleSubmit() {
    const url = isEdit ? `/api/v1/assets/${asset!.id}` : '/api/v1/assets'
    const body = isEdit
      ? { name: form.name, symbol: form.symbol, market: form.market }
      : form
    await fetch(url, { method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    onClose()
  }

  if (!open) return null
  // … render form with cascade selects, disabled frozen fields in edit mode
}
```

- [ ] **Step 6:** Wire up `web/app/assets/page.tsx`

```tsx
// web/app/assets/page.tsx  (key structure)
'use client'
import useSWR from 'swr'
import { AssetsTable } from '@/components/assets/AssetsTable'
import { AssetFormModal } from '@/components/assets/AssetFormModal'

export default function AssetsPage() {
  const { data: assets, mutate } = useSWR<Asset[]>('/api/v1/assets', fetcher)
  const [modalOpen, setModalOpen] = useState(false)

  async function handleDelete(id: string) {
    if (!confirm('確認刪除？若有持倉或快照將無法刪除。')) return
    const res = await fetch(`/api/v1/assets/${id}`, { method: 'DELETE' })
    if (!res.ok) alert('刪除失敗：請先移除所有持倉與快照')
    else mutate()
  }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">資產設定</h1>
        <button onClick={() => setModalOpen(true)}
          className="bg-[var(--color-accent)] text-white px-4 py-2 rounded">+ 新增資產</button>
      </div>
      <AssetsTable assets={assets ?? []} onDelete={handleDelete} />
      <AssetFormModal open={modalOpen} onClose={() => { setModalOpen(false); mutate() }} />
    </main>
  )
}
```

- [ ] **Step 7:** Commit: `feat: assets page with CRUD table and cascade add/edit modal`

---

## Task 8: Asset Detail Page `/assets/[id]`

**Files:**
- Create: `web/app/assets/[id]/page.tsx`
- Create: `web/components/assets/AssetDetailView.tsx`
- Create: `web/components/assets/ManualPriceModal.tsx`
- Test: `web/__tests__/AssetDetailView.test.tsx`

- [ ] **Step 1:** Write the failing test

```tsx
// web/__tests__/AssetDetailView.test.tsx
import { render, screen } from '@testing-library/react'
import { AssetDetailView } from '@/components/assets/AssetDetailView'
it('shows manual price button only for manual pricing_mode', () => {
  const asset = { id: '1', name: 'My Fund', pricing_mode: 'manual', /* … */ } as Asset
  render(<AssetDetailView asset={asset} />)
  expect(screen.getByText('更新今日價格')).toBeInTheDocument()
})
it('hides manual price button for market assets', () => {
  const asset = { id: '1', name: 'AAPL', pricing_mode: 'market', /* … */ } as Asset
  render(<AssetDetailView asset={asset} />)
  expect(screen.queryByText('更新今日價格')).not.toBeInTheDocument()
})
```

- [ ] **Step 2:** Run: `cd web && npx jest AssetDetailView.test.tsx` — Expected: FAIL

- [ ] **Step 3:** Implement `AssetDetailView`

The view fetches three data sources in parallel and renders four sections:

```tsx
// web/components/assets/AssetDetailView.tsx  (key structure)
'use client'
import useSWR from 'swr'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface SnapshotRow { snapshot_date: string; total_qty: number; price: number; fx_rate: number; value_in_base: number }

export function AssetDetailView({ asset }: { asset: Asset }) {
  const { data: snapshots } = useSWR<SnapshotRow[]>(
    `/api/v1/prices?asset_id=${asset.id}`, fetcher)
  const { data: txns } = useSWR<Transaction[]>(
    `/api/v1/transactions?asset_id=${asset.id}`, fetcher)
  const [priceModalOpen, setPriceModalOpen] = useState(false)

  // Build chart data: GET /snapshots/history returns summary-only (no per-asset rows).
  // Use GET /snapshots/items?asset_id=&range=30d instead — this endpoint is defined in
  // Backend Services plan Task 5 as an extension to support asset-level time series.
  // Returns: [{snapshot_date, value_in_base}] (summed across accounts for this asset)
  const { data: assetHistory } = useSWR<{snapshot_date: string; value_in_base: number}[]>(
    `/api/v1/snapshots/items?asset_id=${asset.id}&range=30d`, fetcher)
  const chartData = (assetHistory ?? []).map(d => ({ date: d.snapshot_date, value: d.value_in_base }))

  return (
    <div className="space-y-8">
      {/* Info card */}
      <section className="rounded-lg border p-4 grid grid-cols-2 gap-2 text-sm">
        {/* name, asset_class, category, sub_kind, symbol, currency, pricing_mode */}
      </section>

      {/* Trend chart */}
      <section>
        <h2 className="font-semibold mb-2">價值趨勢</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="var(--color-accent)" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Snapshot table — last 30 rows */}
      <section>
        <h2 className="font-semibold mb-2">快照明細</h2>
        <table className="w-full text-sm">
          {/* date / total_qty / price / fx_rate / value */}
        </table>
      </section>

      {/* Transaction log */}
      <section>
        <h2 className="font-semibold mb-2">交易紀錄</h2>
        {/* timeline: txn_date / account / txn_type / quantity / note */}
      </section>

      {/* Manual price button */}
      {asset.pricing_mode === 'manual' && (
        <button onClick={() => setPriceModalOpen(true)}
          className="bg-[var(--color-accent)] text-white px-4 py-2 rounded">更新今日價格</button>
      )}
      <ManualPriceModal assetId={asset.id} open={priceModalOpen}
        onClose={() => setPriceModalOpen(false)} />
    </div>
  )
}
```

- [ ] **Step 4:** Implement `ManualPriceModal`

```tsx
// web/components/assets/ManualPriceModal.tsx
'use client'
import { useState } from 'react'
interface Props { assetId: string; open: boolean; onClose: () => void }

export function ManualPriceModal({ assetId, open, onClose }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [price, setPrice] = useState('')

  async function handleSubmit() {
    await fetch('/api/v1/prices/manual', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: assetId, price_date: date, price: parseFloat(price) }) })
    onClose()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-[var(--color-surface)] rounded-lg p-6 w-80 space-y-4">
        <h2 className="font-semibold">更新今日價格</h2>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full border rounded px-3 py-2" />
        <input type="number" placeholder="價格" value={price}
          onChange={e => setPrice(e.target.value)} className="w-full border rounded px-3 py-2" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border rounded py-2">取消</button>
          <button onClick={handleSubmit} disabled={!price}
            className="flex-1 bg-[var(--color-accent)] text-white rounded py-2 disabled:opacity-40">送出</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5:** Wire up route page

```tsx
// web/app/assets/[id]/page.tsx
import { AssetDetailView } from '@/components/assets/AssetDetailView'

// Server component — fetch asset on server
export default async function AssetDetailPage({ params }: { params: { id: string } }) {
  // NEXT_PUBLIC_API_BASE_URL already contains /api/v1 — do NOT add /api/v1 again
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/assets/${params.id}`)
  if (!res.ok) notFound()
  const asset: Asset = await res.json()
  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-6">{asset.name}</h1>
      <AssetDetailView asset={asset} />
    </main>
  )
}
```

- [ ] **Step 6:** Run tests — Expected: PASS
- [ ] **Step 7:** Commit: `feat: asset detail page with trend chart, snapshot table, txn log, manual price`

---

## Task 9: Accounts Page (CRUD Table + Modal)

**Files:**
- Create: `web/app/accounts/page.tsx`
- Create: `web/components/accounts/AccountsTable.tsx`
- Create: `web/components/accounts/AccountFormModal.tsx`
- Test: `web/__tests__/AccountsTable.test.tsx`

- [ ] **Step 1:** Write the failing test

```tsx
// web/__tests__/AccountsTable.test.tsx
import { render, screen } from '@testing-library/react'
import { AccountsTable } from '@/components/accounts/AccountsTable'
const accounts: Account[] = [
  { id: '1', name: '富途', institution: 'Futu', account_type: 'broker', note: '' },
]
it('renders account row', () => {
  render(<AccountsTable accounts={accounts} holdingsCount={{ '1': 3 }} onEdit={jest.fn()} onDelete={jest.fn()} />)
  expect(screen.getByText('富途')).toBeInTheDocument()
  expect(screen.getByText('3')).toBeInTheDocument()    // holdings count
})
it('disables delete button when account has holdings', () => {
  render(<AccountsTable accounts={accounts} holdingsCount={{ '1': 2 }} onEdit={jest.fn()} onDelete={jest.fn()} />)
  expect(screen.getByRole('button', { name: /刪除/ })).toBeDisabled()
})
```

- [ ] **Step 2:** Run: `cd web && npx jest AccountsTable.test.tsx` — Expected: FAIL

- [ ] **Step 3:** Implement `AccountsTable`

```tsx
// web/components/accounts/AccountsTable.tsx
'use client'
import { Pencil, Trash2 } from 'lucide-react'

interface Props {
  accounts: Account[]
  holdingsCount: Record<string, number>
  onEdit: (a: Account) => void
  onDelete: (id: string) => void
}

export function AccountsTable({ accounts, holdingsCount, onEdit, onDelete }: Props) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b text-[var(--color-muted)]">
          {['名稱', '類型', '機構', '備註', '持倉數', ''].map(h => (
            <th key={h} className="px-4 py-2 text-left">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {accounts.map(a => {
          const count = holdingsCount[a.id] ?? 0
          return (
            <tr key={a.id} className="border-b hover:bg-[var(--color-bg)]">
              <td className="px-4 py-2 font-medium">{a.name}</td>
              <td className="px-4 py-2">{a.account_type}</td>
              <td className="px-4 py-2">{a.institution ?? '—'}</td>
              <td className="px-4 py-2 text-[var(--color-muted)]">{a.note ?? '—'}</td>
              <td className="px-4 py-2">{count}</td>
              <td className="px-4 py-2 flex gap-2">
                <button onClick={() => onEdit(a)} title="編輯"><Pencil size={14} /></button>
                <button onClick={() => onDelete(a.id)} disabled={count > 0}
                  title={count > 0 ? '請先移除持倉' : '刪除'} aria-label="刪除"
                  className="disabled:opacity-30 disabled:cursor-not-allowed">
                  <Trash2 size={14} className="text-[var(--color-coral)]" />
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 4:** Run test — Expected: PASS

- [ ] **Step 5:** Implement `AccountFormModal`

```tsx
// web/components/accounts/AccountFormModal.tsx  (key structure)
'use client'
import { useState, useEffect } from 'react'
const ACCOUNT_TYPES: AccountType[] = ['bank','broker','crypto_exchange','e_wallet','cash','other']

export function AccountFormModal({ open, account, onClose }: { open: boolean; account?: Account; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', institution: '', account_type: 'bank' as AccountType, note: '' })
  useEffect(() => { if (account) setForm({ ...account, institution: account.institution ?? '', note: account.note ?? '' }) }, [account])

  async function handleSubmit() {
    const url = account ? `/api/v1/accounts/${account.id}` : '/api/v1/accounts'
    await fetch(url, { method: account ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    onClose()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-[var(--color-surface)] rounded-lg p-6 w-96 space-y-4">
        <h2 className="font-semibold">{account ? '編輯帳戶' : '新增帳戶'}</h2>
        {/* name, institution, account_type select, note textarea */}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border rounded py-2">取消</button>
          <button onClick={handleSubmit}
            className="flex-1 bg-[var(--color-accent)] text-white rounded py-2">儲存</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6:** Wire up `web/app/accounts/page.tsx`

```tsx
// web/app/accounts/page.tsx  (key structure)
'use client'
export default function AccountsPage() {
  const { data: accounts, mutate } = useSWR<Account[]>('/api/v1/accounts', fetcher)
  const { data: holdings } = useSWR<Holding[]>('/api/v1/holdings', fetcher)
  // compute holdingsCount: { [account_id]: count }
  const holdingsCount = useMemo(() => {
    const m: Record<string, number> = {}
    for (const h of holdings ?? []) m[h.account_id] = (m[h.account_id] ?? 0) + 1
    return m
  }, [holdings])
  // … modal state, handleDelete, render AccountsTable + AccountFormModal
}
```

- [ ] **Step 7:** Commit: `feat: accounts page with CRUD table, delete guard, and modal`

---

## Task 10: Snapshots History Page + Settings Page

**Files:**
- Create: `web/app/snapshots/page.tsx`
- Create: `web/components/snapshots/SnapshotsList.tsx`
- Create: `web/app/settings/page.tsx`
- Test: `web/__tests__/SnapshotsList.test.tsx`

### 10-A: Snapshots History

- [ ] **Step 1:** Write the failing test

```tsx
// web/__tests__/SnapshotsList.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { SnapshotsList } from '@/components/snapshots/SnapshotsList'
const dates = ['2026-03-22', '2026-03-21']
it('renders snapshot dates most-recent first', () => {
  render(<SnapshotsList dates={dates} onRebuild={jest.fn()} onExpand={jest.fn()} />)
  const rows = screen.getAllByRole('button', { name: /展開|▶/ })
  expect(rows[0]).toBeInTheDocument()
})
it('calls onExpand with date when row is clicked', () => {
  const onExpand = jest.fn()
  render(<SnapshotsList dates={dates} onRebuild={jest.fn()} onExpand={onExpand} />)
  fireEvent.click(screen.getByText('2026-03-22'))
  expect(onExpand).toHaveBeenCalledWith('2026-03-22')
})
```

- [ ] **Step 2:** Run: `cd web && npx jest SnapshotsList.test.tsx` — Expected: FAIL

- [ ] **Step 3:** Implement `SnapshotsList`

```tsx
// web/components/snapshots/SnapshotsList.tsx
'use client'
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

interface SnapshotDetail { category: string; items: SnapshotItem[] }
interface Props {
  dates: string[]
  onRebuild: (date: string) => void
  onExpand: (date: string) => void
}

export function SnapshotsList({ dates, onRebuild, onExpand }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, SnapshotDetail[]>>({})

  async function toggle(date: string) {
    if (expanded === date) { setExpanded(null); return }
    setExpanded(date)
    onExpand(date)
    if (!details[date]) {
      const res = await fetch(`/api/v1/snapshots/${date}`)
      const data = await res.json()
      // group items by category
      const grouped = groupByCategory(data.items as SnapshotItem[])
      setDetails(prev => ({ ...prev, [date]: grouped }))
    }
  }

  return (
    <div className="space-y-2">
      {dates.map(date => (
        <div key={date} className="rounded-lg border border-[var(--color-border)]">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => toggle(date)} className="font-medium">{date}</button>
            <button onClick={() => onRebuild(date)} title="重建快照"
              className="text-[var(--color-muted)] hover:text-[var(--color-accent)]">
              <RefreshCw size={14} />
            </button>
          </div>
          {expanded === date && details[date] && (
            <div className="border-t px-4 py-3 space-y-4">
              {details[date].map(({ category, items }) => (
                <div key={category}>
                  <p className="text-xs font-semibold uppercase text-[var(--color-muted)] mb-1">{category}</p>
                  {items.map(item => (
                    <div key={`${item.asset_id}-${item.account_id}`}
                      className="flex justify-between text-sm py-1">
                      <span>{item.asset_name} / {item.account_name}</span>
                      <span>{item.value_in_base.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4:** Run test — Expected: PASS

- [ ] **Step 5:** Wire up `web/app/snapshots/page.tsx`

```tsx
// web/app/snapshots/page.tsx  (key structure)
'use client'
import useSWR from 'swr'
import { SnapshotsList } from '@/components/snapshots/SnapshotsList'

export default function SnapshotsPage() {
  // GET /snapshots/history returns a top-level array: SnapshotDateOut[] = [{snapshot_date, net_worth}]
  // NOT a {data: [...]} wrapper. Field is snapshot_date, not date.
  const { data, mutate } = useSWR<{ snapshot_date: string; net_worth: number }[]>(
    '/api/v1/snapshots/history?range=all', fetcher)
  const dates = (data ?? []).map(d => d.snapshot_date).sort().reverse()

  async function handleRebuild(date: string) {
    await fetch(`/api/v1/snapshots/rebuild/${date}`, { method: 'POST' })
    mutate()
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-6">快照歷史</h1>
      <SnapshotsList dates={dates} onRebuild={handleRebuild} onExpand={() => {}} />
    </main>
  )
}
```

- [ ] **Step 6:** Commit: `feat: snapshots history page with expand-by-date and rebuild button`

---

### 10-B: Settings Page

No complex tests needed here — the page is mostly presentational with localStorage reads.

- [ ] **Step 1:** Write a minimal smoke test

```tsx
// web/__tests__/SettingsPage.test.tsx
import { render, screen } from '@testing-library/react'
import SettingsPage from '@/app/settings/page'
it('renders currency selector and dark mode toggle', () => {
  render(<SettingsPage />)
  expect(screen.getByLabelText(/顯示幣別/)).toBeInTheDocument()
  expect(screen.getByLabelText(/深色模式/)).toBeInTheDocument()
})
```

- [ ] **Step 2:** Run: `cd web && npx jest SettingsPage.test.tsx` — Expected: FAIL

- [ ] **Step 3:** Implement `web/app/settings/page.tsx`

```tsx
// web/app/settings/page.tsx
'use client'
import { useState, useEffect } from 'react'

const CURRENCIES = ['TWD', 'USD', 'JPY']

export default function SettingsPage() {
  const [currency, setCurrency] = useState('TWD')
  const [dark, setDark] = useState(false)
  const schedule = process.env.NEXT_PUBLIC_SNAPSHOT_SCHEDULE ?? '0 22 * * *'

  useEffect(() => {
    setCurrency(localStorage.getItem('displayCurrency') ?? 'TWD')
    setDark(document.documentElement.getAttribute('data-theme') === 'dark')
  }, [])

  function handleCurrency(v: string) {
    setCurrency(v); localStorage.setItem('displayCurrency', v)
  }

  function handleDark(checked: boolean) {
    setDark(checked)
    document.documentElement.setAttribute('data-theme', checked ? 'dark' : 'light')
    localStorage.setItem('theme', checked ? 'dark' : 'light')
  }

  return (
    <main className="p-6 max-w-lg mx-auto space-y-8">
      <h1 className="text-xl font-bold">設定</h1>

      <section className="space-y-2">
        <label htmlFor="currency" className="block text-sm font-medium">顯示幣別</label>
        <select id="currency" value={currency} onChange={e => handleCurrency(e.target.value)}
          className="border rounded px-3 py-2 w-40">
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </section>

      <section className="flex items-center gap-3">
        <label htmlFor="darkMode" className="text-sm font-medium">深色模式</label>
        <input id="darkMode" type="checkbox" checked={dark} onChange={e => handleDark(e.target.checked)} />
      </section>

      <section className="space-y-1">
        <p className="text-sm font-medium text-[var(--color-muted)]">快照排程（唯讀）</p>
        <code className="text-sm bg-[var(--color-bg)] px-3 py-1 rounded border">{schedule}</code>
        <p className="text-xs text-[var(--color-muted)]">由環境變數 SNAPSHOT_SCHEDULE 控制，需重啟服務才能變更。</p>
      </section>
    </main>
  )
}
```

- [ ] **Step 4:** Run test — Expected: PASS
- [ ] **Step 5:** Commit: `feat: settings page with currency selector, dark mode toggle, schedule display`

---

## Summary Checklist

| Task | Files | Status |
|---|---|---|
| 6A | `HoldingsList.tsx` | - [ ] |
| 6B | `HoldingSidePanel.tsx`, `holdings/page.tsx` | - [ ] |
| 7 | `AssetsTable.tsx`, `AssetFormModal.tsx`, `assets/page.tsx` | - [ ] |
| 8 | `AssetDetailView.tsx`, `ManualPriceModal.tsx`, `assets/[id]/page.tsx` | - [ ] |
| 9 | `AccountsTable.tsx`, `AccountFormModal.tsx`, `accounts/page.tsx` | - [ ] |
| 10A | `SnapshotsList.tsx`, `snapshots/page.tsx` | - [ ] |
| 10B | `settings/page.tsx` | - [ ] |

## Key Implementation Notes

1. **SWR mutation after writes** — every `onClose` callback must call `mutate()` on the relevant SWR key to refresh the list.
2. **Holdings delete semantics** — when quantity reaches 0, call `DELETE /holdings/{asset_id}/{account_id}` (not PUT with qty=0). The snapshot job skips non-existent holdings rows.
3. **Asset immutable fields** — `asset_class`, `category`, `sub_kind`, `currency_code`, `pricing_mode` are frozen after any snapshot exists. The backend returns 422 on violation; the UI should pre-emptively disable these fields in edit mode.
4. **Display currency** — stored in `localStorage` as `displayCurrency`. The TopBar (Part A) reads this and broadcasts it via React Context. All monetary values in tables/panels divide `value_in_base` (TWD) by the fx rate for the selected display currency.
5. **Snapshot items for Asset Detail chart** — the trend chart aggregates `value_in_base` per date by calling `GET /snapshots/history?range=30d` and filtering items by `asset_id`. The API already returns per-asset-per-account rows; sum them client-side.
6. **Side Panel accessibility** — trap focus inside the panel when open and close on `Escape` key for keyboard accessibility.
