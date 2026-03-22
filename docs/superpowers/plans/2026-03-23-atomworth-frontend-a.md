# AtomWorth — Frontend Part A: Setup & Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js 15 frontend and implement the Dashboard page with Treemap, trend chart, and holdings accordion.

**Architecture:** Next.js 15 App Router. Client Components for interactive UI. SWR for data fetching (calls Hono API at NEXT_PUBLIC_API_BASE_URL). CSS variables for theming. Recharts for charts. All API responses use snake_case field names.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Recharts, SWR, lucide-react

**Prerequisite:** Backend plans (Parts 1+2) must be running. See Part B plan for remaining pages.

---

## File Structure (this plan's scope)

```
web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx               # Dashboard
│   └── globals.css
├── components/
│   ├── layout/Sidebar.tsx
│   ├── layout/TopBar.tsx
│   ├── dashboard/NetWorthHeader.tsx
│   ├── dashboard/AllocationTreemap.tsx
│   ├── dashboard/NetWorthChart.tsx
│   └── dashboard/HoldingsAccordion.tsx
├── lib/
│   ├── api.ts
│   ├── types.ts
│   └── utils.ts
├── context/
│   └── CurrencyContext.tsx
├── package.json
├── tailwind.config.ts
├── next.config.ts
└── Dockerfile
```

---

## Task 1: Next.js 15 + TypeScript + Tailwind + shadcn/ui Scaffold

**Files:**
- Create: `web/` (project root via `create-next-app`)
- Create: `web/package.json`, `web/next.config.ts`, `web/tailwind.config.ts`, `web/Dockerfile`
- Test: `web/__tests__/smoke.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/__tests__/smoke.test.tsx
import { render, screen } from '@testing-library/react'
import Page from '../app/page'

// Smoke test: dashboard page renders without crashing
jest.mock('../lib/api', () => ({
  useDashboardSummary: () => ({ data: null, isLoading: true }),
  useAllocation: () => ({ data: null, isLoading: true }),
  useNetWorthHistory: () => ({ data: null, isLoading: true }),
}))

test('dashboard page renders loading state', () => {
  render(<Page />)
  expect(screen.getByTestId('dashboard-root')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run:** `cd web && npx jest smoke.test.tsx` — Expected: **FAIL** (project doesn't exist yet)

- [ ] **Step 3: Scaffold the project**

```bash
# From AtomWorth root
npx create-next-app@latest web \
  --typescript --tailwind --app --no-src-dir \
  --import-alias "@/*" --no-eslint

cd web
npx shadcn@latest init --defaults
npx shadcn@latest add accordion badge button

npm install recharts swr lucide-react
npm install -D @testing-library/react @testing-library/jest-dom jest jest-environment-jsdom
```

`web/next.config.ts` — expose API URL:

```ts
const nextConfig = {
  output: 'standalone',   // required for Dockerfile multi-stage build (.next/standalone)
  env: { NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1' },
}
export default nextConfig
```

`web/jest.config.ts`:

```ts
export default {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
}
```

`web/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 4:** Run smoke test — Expected: **PASS**
- [ ] **Step 5:** Commit: `feat(web): scaffold Next.js 15 + Tailwind + shadcn + Recharts`

---

## Task 2: CSS Variables (Palette 8) + Tailwind Config + globals.css

**Files:**
- Create/Edit: `web/app/globals.css`
- Create/Edit: `web/tailwind.config.ts`
- Test: `web/__tests__/theme.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/__tests__/theme.test.ts
// Verify CSS variable names are present in globals.css
import fs from 'fs'
const css = fs.readFileSync('app/globals.css', 'utf-8')

const requiredVars = [
  '--color-bg', '--color-surface', '--color-accent', '--color-coral',
  '--cat-liquid', '--cat-investment', '--cat-fixed', '--cat-receivable', '--cat-debt',
]
test.each(requiredVars)('globals.css defines %s', (v) => {
  expect(css).toContain(v)
})
```

- [ ] **Step 2:** Run test — Expected: **FAIL**

- [ ] **Step 3: Implement**

`web/app/globals.css` (key additions on top of Tailwind base):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-bg:       #f8f5f2;
  --color-surface:  #fffffe;
  --color-text:     #232323;
  --color-muted:    #888;
  --color-accent:   #078080;
  --color-coral:    #f45d48;
  --color-border:   #e8e8e8;
  --cat-liquid:     #078080;
  --cat-investment: #7c3aed;
  --cat-fixed:      #1d4ed8;
  --cat-receivable: #f59e0b;
  --cat-debt:       #f45d48;
}

[data-theme="dark"] {
  --color-bg:      #1a1916;
  --color-surface: #232320;
  --color-text:    #f8f5f2;
  --color-muted:   #888;
  --color-border:  #333;
  --color-accent:  #0a9e9e;
  --color-coral:   #ff7059;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
}
```

`web/tailwind.config.ts` — map CSS vars to Tailwind tokens:

```ts
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       'var(--color-bg)',
        surface:  'var(--color-surface)',
        accent:   'var(--color-accent)',
        coral:    'var(--color-coral)',
        border:   'var(--color-border)',
        muted:    'var(--color-muted)',
        'cat-liquid':     'var(--cat-liquid)',
        'cat-investment': 'var(--cat-investment)',
        'cat-fixed':      'var(--cat-fixed)',
        'cat-receivable': 'var(--cat-receivable)',
        'cat-debt':       'var(--cat-debt)',
      },
    },
  },
}
```

- [ ] **Step 4:** Run test — Expected: **PASS**
- [ ] **Step 5:** Commit: `feat(web): CSS variables Palette 8 + Tailwind theme tokens`

---

## Task 3: TypeScript Types + API Client + Utils

**Files:**
- Create: `web/lib/types.ts`
- Create: `web/lib/api.ts`
- Create: `web/lib/utils.ts`
- Test: `web/__tests__/api.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/__tests__/api.test.ts
import { formatValue, categoryColor } from '../lib/utils'

test('formatValue formats TWD with no decimals', () => {
  expect(formatValue(12847320, 'TWD')).toBe('NT$12,847,320')
})
test('formatValue formats USD with 2 decimals', () => {
  expect(formatValue(1234.5, 'USD')).toBe('$1,234.50')
})
test('categoryColor returns CSS var for known category', () => {
  expect(categoryColor('investment')).toBe('var(--cat-investment)')
})
test('categoryColor returns fallback for unknown', () => {
  expect(categoryColor('unknown')).toBe('var(--color-muted)')
})
```

- [ ] **Step 2:** Run test — Expected: **FAIL**

- [ ] **Step 3: Implement**

`web/lib/types.ts` — core shapes matching API responses:

```ts
export type Currency = 'TWD' | 'USD' | 'JPY'
export type Category = 'liquid' | 'investment' | 'fixed' | 'receivable' | 'debt'

export interface DashboardSummary {
  snapshotDate: string
  displayCurrency: Currency
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  changeAmount: number | null   // null when no previous snapshot exists (fresh install)
  changePct: number | null      // null when no previous snapshot exists
  missingAssets: string[]
}

export interface AllocationItem { assetId: string; name: string; value: number; pct: number }
export interface AllocationCategory {
  category: Category; label: string; value: number; pct: number; color: string
  items: AllocationItem[]
}
export interface AllocationData { snapshotDate: string; displayCurrency: Currency; categories: AllocationCategory[] }

export interface NetWorthPoint { date: string; netWorth: number }
export interface NetWorthHistory { displayCurrency: Currency; data: NetWorthPoint[] }
```

`web/lib/api.ts` — SWR hooks over `NEXT_PUBLIC_API_BASE_URL`:

```ts
import useSWR from 'swr'
import type { Currency, DashboardSummary, AllocationData, NetWorthHistory } from './types'

export const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1'
export const fetcher = (url: string) => fetch(url).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })

export const useDashboardSummary = (currency: Currency) =>
  useSWR<DashboardSummary>(`${BASE}/dashboard/summary?displayCurrency=${currency}`, fetcher)

export const useAllocation = (currency: Currency, date?: string) =>
  useSWR<AllocationData>(`${BASE}/dashboard/allocation?displayCurrency=${currency}${date ? `&date=${date}` : ''}`, fetcher)

export const useNetWorthHistory = (currency: Currency, range = '30d') =>
  useSWR<NetWorthHistory>(`${BASE}/dashboard/net-worth-history?range=${range}&displayCurrency=${currency}`, fetcher)
```

`web/lib/utils.ts`:

```ts
import type { Category } from './types'

const CURRENCY_FORMATS: Record<string, Intl.NumberFormatOptions> = {
  TWD: { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 },
  USD: { style: 'currency', currency: 'USD', minimumFractionDigits: 2 },
  JPY: { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 },
}

export function formatValue(value: number, currency: string): string {
  const opts = CURRENCY_FORMATS[currency] ?? CURRENCY_FORMATS['TWD']
  return new Intl.NumberFormat('en-US', opts).format(value)
}

const CAT_COLORS: Record<string, string> = {
  liquid: 'var(--cat-liquid)', investment: 'var(--cat-investment)',
  fixed: 'var(--cat-fixed)',   receivable: 'var(--cat-receivable)', debt: 'var(--cat-debt)',
}
export function categoryColor(cat: string): string {
  return CAT_COLORS[cat] ?? 'var(--color-muted)'
}
```

- [ ] **Step 4:** Run test — Expected: **PASS**
- [ ] **Step 5:** Commit: `feat(web): types, API SWR hooks, and utils`

---

## Task 4: Layout — Sidebar + TopBar + CurrencyContext + Theme Toggle

**Files:**
- Create: `web/context/CurrencyContext.tsx`
- Create: `web/components/layout/Sidebar.tsx`
- Create: `web/components/layout/TopBar.tsx`
- Edit: `web/app/layout.tsx`
- Test: `web/__tests__/TopBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/__tests__/TopBar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { CurrencyProvider } from '../context/CurrencyContext'
import TopBar from '../components/layout/TopBar'

const wrap = (ui: React.ReactElement) => render(<CurrencyProvider>{ui}</CurrencyProvider>)

test('renders currency selector with TWD default', () => {
  wrap(<TopBar />)
  expect(screen.getByRole('combobox')).toHaveValue('TWD')
})
test('currency change updates context', () => {
  wrap(<TopBar />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'USD' } })
  expect(screen.getByRole('combobox')).toHaveValue('USD')
})
test('theme toggle button is present', () => {
  wrap(<TopBar />)
  expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument()
})
```

- [ ] **Step 2:** Run test — Expected: **FAIL**

- [ ] **Step 3: Implement**

`web/context/CurrencyContext.tsx`:

```tsx
'use client'
import { createContext, useContext, useState } from 'react'
import type { Currency } from '@/lib/types'

interface CurrencyCtx { currency: Currency; setCurrency: (c: Currency) => void }
const CurrencyContext = createContext<CurrencyCtx>({ currency: 'TWD', setCurrency: () => {} })

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('TWD')
  return <CurrencyContext.Provider value={{ currency, setCurrency }}>{children}</CurrencyContext.Provider>
}
export const useCurrency = () => useContext(CurrencyContext)
```

`web/components/layout/TopBar.tsx`:

```tsx
'use client'
import { useCurrency } from '@/context/CurrencyContext'
import { Moon, Sun } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { Currency } from '@/lib/types'

export default function TopBar() {
  const { currency, setCurrency } = useCurrency()
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark') { setDark(true); document.documentElement.dataset.theme = 'dark' }
  }, [])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.dataset.theme = next ? 'dark' : 'light'
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-surface">
      <span className="font-semibold text-accent">AtomWorth</span>
      <div className="flex items-center gap-3">
        <select aria-label="currency" className="bg-bg border border-border rounded px-2 py-1 text-sm"
          value={currency} onChange={e => setCurrency(e.target.value as Currency)}>
          {(['TWD', 'USD', 'JPY'] as Currency[]).map(c => <option key={c}>{c}</option>)}
        </select>
        <button aria-label="theme toggle" onClick={toggleTheme} className="p-1 rounded hover:bg-bg">
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  )
}
```

`web/components/layout/Sidebar.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Wallet, Briefcase, Building2, Camera, Settings } from 'lucide-react'

const NAV = [
  { href: '/',          label: 'Dashboard',  Icon: LayoutDashboard },
  { href: '/holdings',  label: 'Holdings',   Icon: Wallet },
  { href: '/assets',    label: 'Assets',     Icon: Briefcase },
  { href: '/accounts',  label: 'Accounts',   Icon: Building2 },
  { href: '/snapshots', label: 'Snapshots',  Icon: Camera },
  { href: '/settings',  label: 'Settings',   Icon: Settings },
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <nav className="w-56 min-h-screen bg-surface border-r border-border flex flex-col pt-6 gap-1">
      {NAV.map(({ href, label, Icon }) => (
        <Link key={href} href={href}
          className={`flex items-center gap-3 px-5 py-2.5 text-sm rounded-lg mx-2 transition-colors
            ${path === href ? 'bg-accent text-white' : 'text-[var(--color-text)] hover:bg-bg'}`}>
          <Icon size={16} />{label}
        </Link>
      ))}
    </nav>
  )
}
```

`web/app/layout.tsx`:

```tsx
import './globals.css'
import { CurrencyProvider } from '@/context/CurrencyContext'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CurrencyProvider>
          <TopBar />
          <div className="flex">
            <Sidebar />
            <main className="flex-1 p-6 bg-bg min-h-screen">{children}</main>
          </div>
        </CurrencyProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 4:** Run test — Expected: **PASS**
- [ ] **Step 5:** Commit: `feat(web): Sidebar + TopBar + CurrencyContext + theme toggle`

---

## Task 5: Dashboard Page — NetWorthHeader + AllocationTreemap + NetWorthChart + HoldingsAccordion

This task is split into four sub-components, then assembled into `app/page.tsx`.

### Task 5a: NetWorthHeader

**Files:**
- Create: `web/components/dashboard/NetWorthHeader.tsx`
- Test: `web/__tests__/NetWorthHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/__tests__/NetWorthHeader.test.tsx
import { render, screen } from '@testing-library/react'
import NetWorthHeader from '../components/dashboard/NetWorthHeader'

const summary = {
  snapshotDate: '2026-03-22', displayCurrency: 'TWD' as const,
  netWorth: 12847320, totalAssets: 13199320, totalLiabilities: 352000,
  changeAmount: 289000, changePct: 2.30, missingAssets: [],
}

test('renders net worth value', () => {
  render(<NetWorthHeader summary={summary} />)
  expect(screen.getByTestId('net-worth-value')).toHaveTextContent('12,847,320')
})
test('renders positive change badge with green color class', () => {
  render(<NetWorthHeader summary={summary} />)
  expect(screen.getByTestId('change-badge')).toHaveTextContent('+2.30%')
})
test('renders data-as-of date', () => {
  render(<NetWorthHeader summary={summary} />)
  expect(screen.getByText(/2026-03-22/)).toBeInTheDocument()
})
```

- [ ] **Step 2:** Run test — Expected: **FAIL**

- [ ] **Step 3: Implement**

```tsx
// web/components/dashboard/NetWorthHeader.tsx
'use client'
import type { DashboardSummary } from '@/lib/types'
import { formatValue } from '@/lib/utils'

export default function NetWorthHeader({ summary }: { summary: DashboardSummary }) {
  const positive = summary.changePct >= 0
  return (
    <div className="mb-6">
      <p className="text-sm text-muted mb-1">Net Worth · 資料截至 {summary.snapshotDate}</p>
      <div className="flex items-end gap-3">
        <span data-testid="net-worth-value" className="text-4xl font-bold">
          {formatValue(summary.netWorth, summary.displayCurrency)}
        </span>
        <span data-testid="change-badge"
          className={`mb-1 px-2 py-0.5 rounded text-sm font-medium ${positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
          {positive ? '+' : ''}{summary.changePct.toFixed(2)}%
        </span>
      </div>
      <div className="flex gap-6 mt-2 text-sm text-muted">
        <span>Assets: {formatValue(summary.totalAssets, summary.displayCurrency)}</span>
        <span>Liabilities: <span className="text-coral">{formatValue(summary.totalLiabilities, summary.displayCurrency)}</span></span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4:** Run test — Expected: **PASS**
- [ ] **Step 5:** Commit: `feat(web): NetWorthHeader component`

---

### Task 5b: AllocationTreemap

**Files:**
- Create: `web/components/dashboard/AllocationTreemap.tsx`
- Test: `web/__tests__/AllocationTreemap.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/__tests__/AllocationTreemap.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import AllocationTreemap from '../components/dashboard/AllocationTreemap'

// Recharts renders SVG; jest-environment-jsdom supports this
const alloc = {
  snapshotDate: '2026-03-22', displayCurrency: 'TWD' as const,
  categories: [
    { category: 'investment' as const, label: '投資', value: 8456320, pct: 65.8,
      color: '#7c3aed', items: [{ assetId: 'a1', name: 'AAPL', value: 87320, pct: 0.68 }] },
  ],
}
const onSelect = jest.fn()

test('renders container', () => {
  render(<AllocationTreemap data={alloc} onCategorySelect={onSelect} />)
  expect(screen.getByTestId('allocation-treemap')).toBeInTheDocument()
})
```

- [ ] **Step 2:** Run test — Expected: **FAIL**

- [ ] **Step 3: Implement**

Key points:
- Transform `AllocationData.categories` into the flat array Recharts `<Treemap>` expects.
- Use `customContent` (a render prop) to color each block by `--cat-{category}`.
- On click, call `onCategorySelect(category)` to trigger HoldingsAccordion expansion.

```tsx
// web/components/dashboard/AllocationTreemap.tsx
'use client'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import type { AllocationData, Category } from '@/lib/types'
import { categoryColor, formatValue } from '@/lib/utils'

interface Props { data: AllocationData; onCategorySelect: (cat: Category) => void }

const CustomCell = (props: any) => {
  const { x, y, width, height, category, onClick } = props
  if (width < 4 || height < 4) return null
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <rect x={x} y={y} width={width} height={height}
        fill={categoryColor(category)} stroke="#fff" strokeWidth={2} rx={4} />
      {width > 60 && height > 24 &&
        <text x={x + 8} y={y + 18} fill="#fff" fontSize={12} fontWeight={600}>{props.label}</text>}
    </g>
  )
}

export default function AllocationTreemap({ data, onCategorySelect }: Props) {
  const treeData = data.categories.map(c => ({
    name: c.label, size: c.value, category: c.category,
  }))
  return (
    <div data-testid="allocation-treemap" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap data={treeData} dataKey="size" aspectRatio={4 / 3}
          content={<CustomCell onClick={(c: any) => onCategorySelect(c.category)} />}>
          <Tooltip formatter={(v: number) => formatValue(v, data.displayCurrency)} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4:** Run test — Expected: **PASS**
- [ ] **Step 5:** Commit: `feat(web): AllocationTreemap with category click-through`

---

### Task 5c: NetWorthChart

**Files:**
- Create: `web/components/dashboard/NetWorthChart.tsx`
- Test: `web/__tests__/NetWorthChart.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/__tests__/NetWorthChart.test.tsx
import { render, screen } from '@testing-library/react'
import NetWorthChart from '../components/dashboard/NetWorthChart'

const history = {
  displayCurrency: 'TWD' as const,
  data: [
    { date: '2026-01-01', netWorth: 11200000 },
    { date: '2026-01-02', netWorth: 11350000 },
  ],
}

test('renders chart container', () => {
  render(<NetWorthChart data={history} />)
  expect(screen.getByTestId('net-worth-chart')).toBeInTheDocument()
})
```

- [ ] **Step 2:** Run test — Expected: **FAIL**

- [ ] **Step 3: Implement**

```tsx
// web/components/dashboard/NetWorthChart.tsx
'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { NetWorthHistory } from '@/lib/types'
import { formatValue } from '@/lib/utils'

export default function NetWorthChart({ data }: { data: NetWorthHistory }) {
  const fmt = (v: number) => formatValue(v, data.displayCurrency)
  return (
    <div data-testid="net-worth-chart" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
            tickFormatter={d => d.slice(5)} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted)' }} tickFormatter={fmt} width={80} />
          <Tooltip formatter={fmt} labelStyle={{ color: 'var(--color-text)' }} />
          <Line type="monotone" dataKey="netWorth" stroke="var(--color-accent)"
            strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4:** Run test — Expected: **PASS**
- [ ] **Step 5:** Commit: `feat(web): NetWorthChart line chart component`

---

### Task 5d: HoldingsAccordion

**Files:**
- Create: `web/components/dashboard/HoldingsAccordion.tsx`
- Test: `web/__tests__/HoldingsAccordion.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/__tests__/HoldingsAccordion.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import HoldingsAccordion from '../components/dashboard/HoldingsAccordion'

const alloc = {
  snapshotDate: '2026-03-22', displayCurrency: 'TWD' as const,
  categories: [
    { category: 'investment' as const, label: '投資', value: 8456320, pct: 65.8, color: '#7c3aed',
      items: [{ assetId: 'a1', name: 'AAPL', value: 87320, pct: 0.68 }] },
  ],
}

test('renders category header', () => {
  render(<HoldingsAccordion data={alloc} expandedCategory={null} />)
  expect(screen.getByText('投資')).toBeInTheDocument()
})
test('shows items when expandedCategory matches', () => {
  render(<HoldingsAccordion data={alloc} expandedCategory="investment" />)
  expect(screen.getByText('AAPL')).toBeInTheDocument()
})
test('hides items when expandedCategory is null', () => {
  render(<HoldingsAccordion data={alloc} expandedCategory={null} />)
  expect(screen.queryByText('AAPL')).not.toBeInTheDocument()
})
```

- [ ] **Step 2:** Run test — Expected: **FAIL**

- [ ] **Step 3: Implement**

Key design points:
- `expandedCategory` prop is controlled externally (set by Treemap click or user click on header).
- Row click navigates to `/assets/[assetId]` via Next.js `<Link>`.
- Category header color uses `categoryColor(category)`.

```tsx
// web/components/dashboard/HoldingsAccordion.tsx
'use client'
import Link from 'next/link'
import type { AllocationData, Category } from '@/lib/types'
import { categoryColor, formatValue } from '@/lib/utils'
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface Props { data: AllocationData; expandedCategory: Category | null }

export default function HoldingsAccordion({ data, expandedCategory }: Props) {
  const [localExpanded, setLocalExpanded] = useState<Category | null>(null)
  const active = expandedCategory ?? localExpanded

  return (
    <div className="mt-4 space-y-2">
      {data.categories.map(cat => (
        <div key={cat.category} className="rounded-lg border border-border overflow-hidden">
          <button onClick={() => setLocalExpanded(active === cat.category ? null : cat.category)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold bg-surface">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ background: categoryColor(cat.category) }} />
              {cat.label}
              <span className="text-muted font-normal">{cat.pct.toFixed(1)}%</span>
            </span>
            <span className="flex items-center gap-2">
              <span>{formatValue(cat.value, data.displayCurrency)}</span>
              {active === cat.category ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </button>
          {active === cat.category && (
            <ul className="divide-y divide-border bg-bg">
              {cat.items.map(item => (
                <li key={item.assetId}>
                  <Link href={`/assets/${item.assetId}`}
                    className="flex justify-between px-6 py-2 text-sm hover:bg-surface transition-colors">
                    <span>{item.name}</span>
                    <span className="text-muted">{formatValue(item.value, data.displayCurrency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4:** Run test — Expected: **PASS**
- [ ] **Step 5:** Commit: `feat(web): HoldingsAccordion with Treemap-driven expansion`

---

### Task 5e: Assemble Dashboard Page

**Files:**
- Edit: `web/app/page.tsx`
- Test: `web/__tests__/DashboardPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/__tests__/DashboardPage.test.tsx
import { render, screen } from '@testing-library/react'
import DashboardPage from '../app/page'

jest.mock('../lib/api', () => ({
  useDashboardSummary: () => ({ data: null, isLoading: true }),
  useAllocation: () => ({ data: null, isLoading: true }),
  useNetWorthHistory: () => ({ data: null, isLoading: true }),
}))
jest.mock('../context/CurrencyContext', () => ({
  useCurrency: () => ({ currency: 'TWD', setCurrency: jest.fn() }),
}))

test('dashboard renders loading skeleton', () => {
  render(<DashboardPage />)
  expect(screen.getByTestId('dashboard-root')).toBeInTheDocument()
  expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument()
})
```

- [ ] **Step 2:** Run test — Expected: **FAIL**

- [ ] **Step 3: Implement**

```tsx
// web/app/page.tsx
'use client'
import { useState } from 'react'
import { useCurrency } from '@/context/CurrencyContext'
import { useDashboardSummary, useAllocation, useNetWorthHistory } from '@/lib/api'
import NetWorthHeader from '@/components/dashboard/NetWorthHeader'
import AllocationTreemap from '@/components/dashboard/AllocationTreemap'
import NetWorthChart from '@/components/dashboard/NetWorthChart'
import HoldingsAccordion from '@/components/dashboard/HoldingsAccordion'
import type { Category } from '@/lib/types'

export default function DashboardPage() {
  const { currency } = useCurrency()
  const { data: summary, isLoading: s1 } = useDashboardSummary(currency)
  const { data: alloc,   isLoading: s2 } = useAllocation(currency)
  const { data: history, isLoading: s3 } = useNetWorthHistory(currency)
  const [activeCat, setActiveCat] = useState<Category | null>(null)

  const isLoading = s1 || s2 || s3

  return (
    <div data-testid="dashboard-root">
      {isLoading && <div data-testid="dashboard-loading" className="animate-pulse space-y-4">
        <div className="h-20 bg-surface rounded-lg" />
        <div className="grid grid-cols-2 gap-4"><div className="h-64 bg-surface rounded-lg" /><div className="h-64 bg-surface rounded-lg" /></div>
      </div>}
      {!isLoading && summary && alloc && history && (
        <>
          <NetWorthHeader summary={summary} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-surface rounded-xl p-4 border border-border">
              <h2 className="text-sm font-semibold mb-3">Asset Allocation</h2>
              <AllocationTreemap data={alloc} onCategorySelect={setActiveCat} />
            </div>
            <div className="bg-surface rounded-xl p-4 border border-border">
              <h2 className="text-sm font-semibold mb-3">Net Worth Trend</h2>
              <NetWorthChart data={history} />
            </div>
          </div>
          <HoldingsAccordion data={alloc} expandedCategory={activeCat} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4:** Run test — Expected: **PASS**
- [ ] **Step 5:** Commit: `feat(web): Dashboard page assembles all widgets`

---

## Integration Check

After all tasks pass:

- [ ] `cd web && npm run build` — Expected: no TypeScript or build errors
- [ ] `docker compose up web` — Expected: `http://localhost:3000` loads Dashboard
- [ ] With backend running and data seeded: Treemap renders categories, clicking a block expands the matching accordion section, currency toggle re-labels all values, dark mode persists on refresh

---

## Summary of API Contracts Used (Part A)

| Endpoint | Used by |
|---|---|
| `GET /dashboard/summary?displayCurrency=` | `NetWorthHeader` |
| `GET /dashboard/allocation?displayCurrency=` | `AllocationTreemap`, `HoldingsAccordion` |
| `GET /dashboard/net-worth-history?range=&displayCurrency=` | `NetWorthChart` |

All other endpoints (`/assets`, `/holdings`, `/accounts`, etc.) are consumed in Part B.
