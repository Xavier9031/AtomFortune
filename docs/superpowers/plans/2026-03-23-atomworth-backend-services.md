# Atom Fortune — Backend Services & Dashboard Implementation Plan (TypeScript)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement yahoo-finance2/CoinGecko fetch services, daily snapshot job, snapshots API, and dashboard aggregation API.

**Architecture:** Services are plain TypeScript modules (no Hono coupling). node-cron registered at app startup. Snapshot job deletes existing day's data then re-inserts in a DB transaction. Dashboard reads from snapshot_items only.

**Tech Stack:** TypeScript, Hono, Drizzle ORM, node-cron, yahoo-finance2, Zod, Vitest

**Prerequisite:** Backend Foundation plan (Part 1) must be complete.

---

## New Files Created in This Plan

```
api/src/
├── jobs/
│   ├── snapshot.job.ts        # daily_snapshot_job(db) — full snapshot logic
│   ├── pricing.service.ts     # fetchMarketPrices(assets) — yahoo-finance2
│   └── fx.service.ts          # fetchFxRates() — exchangerate-api + CoinGecko
└── modules/
    ├── snapshots/
    │   ├── snapshots.controller.ts
    │   ├── snapshots.service.ts
    │   └── snapshots.repository.ts
    └── dashboard/
        ├── dashboard.controller.ts
        ├── dashboard.service.ts
        └── dashboard.repository.ts
api/tests/
├── snapshot-job.test.ts       # Unit tests (mock yahoo-finance2 + fetch)
├── snapshots-api.test.ts
└── dashboard.test.ts
```

---

## Task 1: Pricing Service

**Files:**
- Create: `api/src/jobs/pricing.service.ts`
- Test: `api/tests/snapshot-job.test.ts` (pricing section)

### Overview

`fetchMarketPrices(assets)` accepts an array of asset records. It filters to `pricingMode = 'market'` assets with a non-null `symbol`, batches the symbols into a single `yahooFinance.quote(symbols)` call, and returns `Map<assetId, price>`. Assets with no valid quote are silently skipped — the caller handles fallback.

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/snapshot-job.test.ts  — pricing section
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchMarketPrices } from '../src/jobs/pricing.service'

vi.mock('yahoo-finance2', () => ({
  default: {
    quote: vi.fn(),
  },
}))

import yahooFinance from 'yahoo-finance2'

const ASSET_AAPL = { id: 'uuid-aapl', symbol: 'AAPL', pricingMode: 'market' as const }
const ASSET_MANUAL = { id: 'uuid-manual', symbol: null, pricingMode: 'manual' as const }
const ASSET_FIXED = { id: 'uuid-fixed', symbol: null, pricingMode: 'fixed' as const }

describe('fetchMarketPrices', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns price for a single market asset', async () => {
    vi.mocked(yahooFinance.quote).mockResolvedValueOnce([
      { symbol: 'AAPL', regularMarketPrice: 210.5 },
    ] as any)
    const result = await fetchMarketPrices([ASSET_AAPL])
    expect(result.get('uuid-aapl')).toBeCloseTo(210.5)
  })

  it('skips non-market assets — yahoo-finance2 never called', async () => {
    const result = await fetchMarketPrices([ASSET_MANUAL, ASSET_FIXED])
    expect(yahooFinance.quote).not.toHaveBeenCalled()
    expect(result.size).toBe(0)
  })

  it('skips market asset with null symbol', async () => {
    const result = await fetchMarketPrices([{ id: 'x', symbol: null, pricingMode: 'market' }])
    expect(yahooFinance.quote).not.toHaveBeenCalled()
    expect(result.size).toBe(0)
  })

  it('handles multiple tickers in one batch call', async () => {
    const ASSET_MSFT = { id: 'uuid-msft', symbol: 'MSFT', pricingMode: 'market' as const }
    vi.mocked(yahooFinance.quote).mockResolvedValueOnce([
      { symbol: 'AAPL', regularMarketPrice: 210.5 },
      { symbol: 'MSFT', regularMarketPrice: 415.0 },
    ] as any)
    const result = await fetchMarketPrices([ASSET_AAPL, ASSET_MSFT])
    expect(yahooFinance.quote).toHaveBeenCalledTimes(1)
    expect(result.get('uuid-aapl')).toBeCloseTo(210.5)
    expect(result.get('uuid-msft')).toBeCloseTo(415.0)
  })

  it('skips asset whose symbol returns null regularMarketPrice', async () => {
    vi.mocked(yahooFinance.quote).mockResolvedValueOnce([
      { symbol: 'AAPL', regularMarketPrice: null },
    ] as any)
    const result = await fetchMarketPrices([ASSET_AAPL])
    expect(result.size).toBe(0)
  })
})
```

- [ ] **Step 2: Run vitest — confirm FAIL**

```bash
cd api && npx vitest run tests/snapshot-job.test.ts
```

Expected: `Cannot find module '../src/jobs/pricing.service'`

- [ ] **Step 3: Implement `api/src/jobs/pricing.service.ts`**

```ts
import yahooFinance from 'yahoo-finance2'

type AssetInput = { id: string; symbol: string | null; pricingMode: string }

export async function fetchMarketPrices(assets: AssetInput[]): Promise<Map<string, number>> {
  const marketAssets = assets.filter(a => a.pricingMode === 'market' && a.symbol)
  const result = new Map<string, number>()
  if (marketAssets.length === 0) return result

  const symbolToId = new Map(marketAssets.map(a => [a.symbol!, a.id]))
  const symbols = [...symbolToId.keys()]

  // yahoo-finance2 quote() accepts string[] and returns QuoteResult[]
  const quotes = await yahooFinance.quote(symbols)
  const quoteArray = Array.isArray(quotes) ? quotes : [quotes]

  for (const q of quoteArray) {
    if (q.regularMarketPrice != null) {
      const assetId = symbolToId.get(q.symbol)
      if (assetId) result.set(assetId, q.regularMarketPrice)
    }
  }
  return result
}
```

- [ ] **Step 4: Run vitest — confirm PASS**

```bash
cd api && npx vitest run tests/snapshot-job.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add api/src/jobs/pricing.service.ts api/tests/snapshot-job.test.ts
git commit -m "feat: add pricing service using yahoo-finance2"
```

---

## Task 2: FX Service

**Files:**
- Create: `api/src/jobs/fx.service.ts`
- Test: `api/tests/snapshot-job.test.ts` (FX section, appended)

### Overview

`fetchFxRates()` fetches USD→TWD and JPY→TWD from exchangerate-api (base=TWD, so rates are inverted: `USD→TWD = 1 / rates.USD`) and USDT→TWD from CoinGecko. Returns `Array<{fromCurrency, toCurrency, rate, source}>`. TWD→TWD is always appended as a system constant (rate=1.0).

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/snapshot-job.test.ts  — FX section (append after pricing tests)
import { fetchFxRates } from '../src/jobs/fx.service'

describe('fetchFxRates', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('returns USD/JPY/USDT/TWD rates with correct sources', async () => {
    const mockFetch = vi.mocked(fetch)
    // exchangerate-api: base=TWD, so rates.USD = 0.03058 means 1 TWD = 0.03058 USD
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rates: { USD: 0.030581, JPY: 4.6296 } }),
    } as Response)
    // CoinGecko: tether.twd = 32.68
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tether: { twd: 32.68 } }),
    } as Response)

    const rates = await fetchFxRates()

    const usd = rates.find(r => r.fromCurrency === 'USD')
    const jpy = rates.find(r => r.fromCurrency === 'JPY')
    const usdt = rates.find(r => r.fromCurrency === 'USDT')
    const twd = rates.find(r => r.fromCurrency === 'TWD')

    expect(usd?.rate).toBeCloseTo(1 / 0.030581, 4)
    expect(usd?.source).toBe('exchangerate-api')
    expect(jpy?.rate).toBeCloseTo(1 / 4.6296, 4)
    expect(usdt?.rate).toBeCloseTo(32.68)
    expect(usdt?.source).toBe('coingecko')
    expect(twd?.rate).toBe(1.0)
    expect(twd?.source).toBe('system')
  })

  it('throws if exchangerate-api response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response)
    await expect(fetchFxRates()).rejects.toThrow('exchangerate-api')
  })
})
```

- [ ] **Step 2: Run vitest — confirm FAIL**

- [ ] **Step 3: Implement `api/src/jobs/fx.service.ts`**

```ts
import { config } from '../config'   // EXCHANGERATE_API_KEY

export interface FxRateRecord {
  fromCurrency: string
  toCurrency: string
  rate: number
  source: string
}

export async function fetchFxRates(): Promise<FxRateRecord[]> {
  const results: FxRateRecord[] = []

  // exchangerate-api: GET /v4/latest/TWD — returns how many TWD each currency costs
  // i.e. rates.USD = 0.0306 means 1 TWD = 0.0306 USD  →  1 USD = 1/0.0306 TWD
  const exRes = await fetch(
    `https://v6.exchangerate-api.com/v6/${config.exchangerateApiKey}/latest/TWD`
  )
  if (!exRes.ok) throw new Error(`exchangerate-api error: ${exRes.status}`)
  const exData = await exRes.json()

  for (const [currency, invRate] of Object.entries(exData.rates) as [string, number][]) {
    if (currency === 'USD' || currency === 'JPY') {
      results.push({
        fromCurrency: currency,
        toCurrency: 'TWD',
        rate: 1 / invRate,
        source: 'exchangerate-api',
      })
    }
  }

  // CoinGecko: USDT→TWD
  const cgRes = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=twd'
  )
  if (!cgRes.ok) throw new Error(`coingecko error: ${cgRes.status}`)
  const cgData = await cgRes.json()
  results.push({
    fromCurrency: 'USDT',
    toCurrency: 'TWD',
    rate: cgData.tether.twd,
    source: 'coingecko',
  })

  // TWD→TWD is always 1.0 (system constant)
  results.push({ fromCurrency: 'TWD', toCurrency: 'TWD', rate: 1.0, source: 'system' })

  return results
}
```

- [ ] **Step 4: Run vitest — confirm PASS**

- [ ] **Step 5: Commit**

```bash
git add api/src/jobs/fx.service.ts api/tests/snapshot-job.test.ts
git commit -m "feat: add FX service using exchangerate-api and CoinGecko"
```

---

## Task 3: Snapshot Job Core Logic

**Files:**
- Create: `api/src/jobs/snapshot.job.ts`
- Test: `api/tests/snapshot-job.test.ts` (snapshot job section, appended)

### Overview

`dailySnapshotJob(db, snapshotDate?)` is the orchestrator. It calls `fetchMarketPrices` and `fetchFxRates`, writes those to the `prices` and `fxRates` tables, then opens a Drizzle transaction that: deletes today's `snapshotItems`, iterates every `holding`, resolves price and fxRate (with fallback), computes `valueInBase`, and inserts a new row. Assets that cannot be resolved are collected in `missingAssets` and logged.

**Fallback rules:**
- `market`/`manual` price: search `prices` table within last 30 days (most recent first)
- `fixed` pricing: price is always 1.0
- fxRate: search `fxRates` table within last 7 days (most recent first)
- TWD assets: fx_rate = 1.0 always

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/snapshot-job.test.ts  — snapshot job section (append)
import { dailySnapshotJob } from '../src/jobs/snapshot.job'
import * as pricingService from '../src/jobs/pricing.service'
import * as fxService from '../src/jobs/fx.service'

vi.mock('../src/jobs/pricing.service')
vi.mock('../src/jobs/fx.service')

describe('dailySnapshotJob', () => {
  let mockDb: any

  beforeEach(() => {
    vi.clearAllMocks()
    // Minimal mock: db.transaction executes the callback immediately
    mockDb = {
      transaction: vi.fn(async (cb: any) => cb(mockDb)),
      select: vi.fn(),
      insert: vi.fn(() => ({ values: vi.fn() })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    }
  })

  it('calls fetchMarketPrices and fetchFxRates exactly once', async () => {
    vi.mocked(pricingService.fetchMarketPrices).mockResolvedValue(new Map())
    vi.mocked(fxService.fetchFxRates).mockResolvedValue([])
    // stub DB helpers to return empty holdings
    vi.spyOn(require('../src/jobs/snapshot.job'), 'getMarketAssets').mockResolvedValue([])
    vi.spyOn(require('../src/jobs/snapshot.job'), 'getAllHoldingsWithAssets').mockResolvedValue([])

    await dailySnapshotJob(mockDb, new Date('2026-03-22'))

    expect(pricingService.fetchMarketPrices).toHaveBeenCalledTimes(1)
    expect(fxService.fetchFxRates).toHaveBeenCalledTimes(1)
  })

  it('skips holding when price cannot be resolved and records missing asset', async () => {
    vi.mocked(pricingService.fetchMarketPrices).mockResolvedValue(new Map())
    vi.mocked(fxService.fetchFxRates).mockResolvedValue([
      { fromCurrency: 'USD', toCurrency: 'TWD', rate: 32.5, source: 'test' },
    ])
    const holding = {
      assetId: 'uuid-aapl', accountId: 'uuid-acc', quantity: '10',
      pricingMode: 'market', currencyCode: 'USD',
    }
    vi.spyOn(require('../src/jobs/snapshot.job'), 'getMarketAssets').mockResolvedValue([])
    vi.spyOn(require('../src/jobs/snapshot.job'), 'getAllHoldingsWithAssets')
      .mockResolvedValue([holding])
    // resolvePrice returns null (no price in DB)
    vi.spyOn(require('../src/jobs/snapshot.job'), 'resolvePrice').mockResolvedValue(null)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await dailySnapshotJob(mockDb, new Date('2026-03-22'))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Missing'), expect.arrayContaining(['uuid-aapl']))
  })

  it('inserts snapshot_item when price and fx_rate are available', async () => {
    vi.mocked(pricingService.fetchMarketPrices).mockResolvedValue(new Map())
    vi.mocked(fxService.fetchFxRates).mockResolvedValue([])
    const holding = {
      assetId: 'uuid-aapl', accountId: 'uuid-acc', quantity: '10',
      pricingMode: 'market', currencyCode: 'USD',
    }
    vi.spyOn(require('../src/jobs/snapshot.job'), 'getMarketAssets').mockResolvedValue([])
    vi.spyOn(require('../src/jobs/snapshot.job'), 'getAllHoldingsWithAssets')
      .mockResolvedValue([holding])
    vi.spyOn(require('../src/jobs/snapshot.job'), 'resolvePrice').mockResolvedValue(210.5)
    vi.spyOn(require('../src/jobs/snapshot.job'), 'resolveFxRate').mockResolvedValue(32.5)

    const insertValues = vi.fn()
    mockDb.insert = vi.fn(() => ({ values: insertValues }))

    await dailySnapshotJob(mockDb, new Date('2026-03-22'))

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotDate: '2026-03-22',
        assetId: 'uuid-aapl',
        valueInBase: String(10 * 210.5 * 32.5),
      })
    )
  })
})
```

- [ ] **Step 2: Run vitest — confirm FAIL**

- [ ] **Step 3: Implement `api/src/jobs/snapshot.job.ts`**

```ts
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { assets, holdings, prices, fxRates, snapshotItems } from '../../db/schema'
import { fetchMarketPrices } from './pricing.service'
import { fetchFxRates } from './fx.service'
import type { DrizzleDB } from '../../db/client'

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)  // 'YYYY-MM-DD'
}

export async function getMarketAssets(db: DrizzleDB) {
  return db.select().from(assets).where(eq(assets.pricingMode, 'market'))
}

export async function getAllHoldingsWithAssets(tx: DrizzleDB) {
  // Join holdings with assets to get pricingMode + currencyCode
  return tx
    .select({
      assetId: holdings.assetId, accountId: holdings.accountId,
      quantity: holdings.quantity, pricingMode: assets.pricingMode,
      currencyCode: assets.currencyCode,
    })
    .from(holdings)
    .innerJoin(assets, eq(holdings.assetId, assets.id))
}

export async function resolvePrice(
  tx: DrizzleDB, assetId: string, pricingMode: string, today: string
): Promise<number | null> {
  if (pricingMode === 'fixed') return 1.0
  const cutoff = formatDate(new Date(Date.now() - 30 * 86400_000))
  const rows = await tx
    .select({ price: prices.price, priceDate: prices.priceDate })
    .from(prices)
    .where(and(eq(prices.assetId, assetId), gte(prices.priceDate, cutoff), lte(prices.priceDate, today)))
    .orderBy(desc(prices.priceDate))
    .limit(1)
  return rows.length ? Number(rows[0].price) : null
}

export async function resolveFxRate(
  tx: DrizzleDB, currencyCode: string, today: string
): Promise<number> {
  if (currencyCode === 'TWD') return 1.0
  const cutoff = formatDate(new Date(Date.now() - 7 * 86400_000))
  const rows = await tx
    .select({ rate: fxRates.rate })
    .from(fxRates)
    .where(and(
      eq(fxRates.fromCurrency, currencyCode),
      eq(fxRates.toCurrency, 'TWD'),
      gte(fxRates.rateDate, cutoff),
      lte(fxRates.rateDate, today),
    ))
    .orderBy(desc(fxRates.rateDate))
    .limit(1)
  return rows.length ? Number(rows[0].rate) : 1.0  // last-resort fallback
}

async function upsertPrices(db: DrizzleDB, pricesMap: Map<string, number>, today: string) {
  for (const [assetId, price] of pricesMap) {
    await db.insert(prices)
      .values({ assetId, priceDate: today, price: String(price), source: 'yahoo-finance2',
                createdAt: new Date(), updatedAt: new Date() })
      .onConflictDoUpdate({ target: [prices.assetId, prices.priceDate],
                            set: { price: String(price), source: 'yahoo-finance2', updatedAt: new Date() } })
  }
}

async function upsertFxRates(db: DrizzleDB, rates: Awaited<ReturnType<typeof fetchFxRates>>, today: string) {
  for (const r of rates) {
    await db.insert(fxRates)
      .values({ fromCurrency: r.fromCurrency, toCurrency: r.toCurrency,
                rateDate: today, rate: String(r.rate), source: r.source,
                createdAt: new Date(), updatedAt: new Date() })
      .onConflictDoUpdate({ target: [fxRates.fromCurrency, fxRates.toCurrency, fxRates.rateDate],
                            set: { rate: String(r.rate), source: r.source, updatedAt: new Date() } })
  }
}

export async function dailySnapshotJob(db: DrizzleDB, snapshotDate = new Date()) {
  const today = formatDate(snapshotDate)

  const marketAssets = await getMarketAssets(db)
  const pricesMap = await fetchMarketPrices(marketAssets)
  await upsertPrices(db, pricesMap, today)

  const rates = await fetchFxRates()
  await upsertFxRates(db, rates, today)

  await db.transaction(async (tx) => {
    await tx.delete(snapshotItems).where(eq(snapshotItems.snapshotDate, today))

    const holdingRows = await getAllHoldingsWithAssets(tx)
    const missingAssets: string[] = []

    for (const h of holdingRows) {
      const price = await resolvePrice(tx, h.assetId, h.pricingMode, today)
      if (price === null) { missingAssets.push(h.assetId); continue }

      const fxRate = await resolveFxRate(tx, h.currencyCode, today)
      const valueInBase = Number(h.quantity) * price * fxRate

      await tx.insert(snapshotItems).values({
        snapshotDate: today, assetId: h.assetId, accountId: h.accountId,
        quantity: h.quantity, price: String(price), fxRate: String(fxRate),
        valueInBase: String(valueInBase), createdAt: new Date(), updatedAt: new Date(),
      })
    }

    if (missingAssets.length) console.warn('Missing assets:', missingAssets)
  })
}
```

- [ ] **Step 4: Run vitest — confirm PASS**

- [ ] **Step 5: Commit**

```bash
git add api/src/jobs/snapshot.job.ts api/tests/snapshot-job.test.ts
git commit -m "feat: implement daily snapshot job with DB transaction and fallback price resolution"
```

---

## Task 4: node-cron Registration + Manual Trigger Endpoint

**Files:**
- Edit: `api/src/index.ts`
- Test: `api/tests/snapshot-job.test.ts` (cron registration check, appended)

### Overview

Register the cron schedule at startup using `cron.schedule(config.snapshotSchedule, ...)`. Add `POST /snapshots/trigger` as a manual escape hatch for dev/debug (calls `dailySnapshotJob` synchronously, returns `{triggered: true, date: string}`). The trigger endpoint does **not** go through the snapshots controller to keep the job free of Hono coupling.

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/snapshot-job.test.ts  — cron section (append)
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }))
vi.mock('../src/jobs/snapshot.job', () => ({ dailySnapshotJob: vi.fn() }))

describe('cron registration in index.ts', () => {
  it('registers cron with SNAPSHOT_SCHEDULE from config', async () => {
    const cron = await import('node-cron')
    await import('../src/index')  // side-effect: registers cron
    expect(cron.default.schedule).toHaveBeenCalledWith(
      expect.stringMatching(/\d+ \d+ \* \* \*/),
      expect.any(Function)
    )
  })
})
```

- [ ] **Step 2: Run vitest — confirm FAIL**

- [ ] **Step 3: Edit `api/src/index.ts`**

Add after existing route registration:

```ts
import cron from 'node-cron'
import { db } from '../db/client'
import { dailySnapshotJob } from './jobs/snapshot.job'
import { config } from './config'

// Register daily snapshot cron (default: '0 22 * * *')
cron.schedule(config.snapshotSchedule, () => {
  dailySnapshotJob(db).catch(err => console.error('Snapshot job failed:', err))
})

// Manual trigger for dev/debug
app.post('/snapshots/trigger', async (c) => {
  const dateParam = c.req.query('date')
  const snapshotDate = dateParam ? new Date(dateParam) : new Date()
  await dailySnapshotJob(db, snapshotDate)
  return c.json({ triggered: true, date: snapshotDate.toISOString().slice(0, 10) })
})
```

- [ ] **Step 4: Run vitest — confirm PASS**

- [ ] **Step 5: Commit**

```bash
git add api/src/index.ts api/tests/snapshot-job.test.ts
git commit -m "feat: register node-cron daily snapshot job and add POST /snapshots/trigger"
```

---

## Task 5: Snapshots Repository + Service + Controller (5 endpoints)

**Files:**
- Create: `api/src/modules/snapshots/snapshots.repository.ts`
- Create: `api/src/modules/snapshots/snapshots.service.ts`
- Create: `api/src/modules/snapshots/snapshots.controller.ts`
- Test: `api/tests/snapshots-api.test.ts`

### API Endpoints

```
GET  /snapshots/history?range=30d|1y|all
GET  /snapshots/items?asset_id=&range=30d|1y|all
GET  /snapshots/:date
POST /snapshots/rebuild/:date
POST /snapshots/rebuild-range   body: {from, to}
```

### Repository Contract

```ts
// snapshots.repository.ts
getSnapshotHistory(db, range: '30d' | '1y' | 'all'): Promise<{snapshotDate: string, netWorth: string}[]>
getSnapshotByDate(db, date: string): Promise<SnapshotDetailOut | null>
getSnapshotItemsByAsset(db, assetId: string, range: '30d' | '1y' | 'all'): Promise<{snapshotDate: string, valueInBase: string}[]>
```

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/snapshots-api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { testClient } from 'hono/testing'
import { app } from '../src/index'

vi.mock('../src/modules/snapshots/snapshots.repository', () => ({
  getSnapshotHistory: vi.fn(),
  getSnapshotByDate: vi.fn(),
  getSnapshotItemsByAsset: vi.fn(),
}))
vi.mock('../src/jobs/snapshot.job', () => ({ dailySnapshotJob: vi.fn() }))

import * as repo from '../src/modules/snapshots/snapshots.repository'
import { dailySnapshotJob } from '../src/jobs/snapshot.job'

describe('GET /snapshots/history', () => {
  it('returns 200 with array for valid range', async () => {
    vi.mocked(repo.getSnapshotHistory).mockResolvedValue([
      { snapshotDate: '2026-03-22', netWorth: '12847320.00' },
    ])
    const res = await testClient(app).snapshots.history.$get({ query: { range: '30d' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].snapshotDate).toBe('2026-03-22')
  })

  it('returns 400 for invalid range param', async () => {
    const res = await testClient(app).snapshots.history.$get({ query: { range: 'bad' } })
    expect(res.status).toBe(400)
  })
})

describe('GET /snapshots/items', () => {
  it('returns value series for a given asset_id and range', async () => {
    vi.mocked(repo.getSnapshotItemsByAsset).mockResolvedValue([
      { snapshotDate: '2026-03-22', valueInBase: '87320.00' },
    ])
    const res = await testClient(app).snapshots.items.$get({
      query: { asset_id: 'uuid-aapl', range: '1y' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].value_in_base).toBe('87320.00')
  })
})

describe('GET /snapshots/:date', () => {
  it('returns snapshot detail when found', async () => {
    vi.mocked(repo.getSnapshotByDate).mockResolvedValue({
      snapshotDate: '2026-03-22', netWorth: 12847320, items: [],
    } as any)
    const res = await testClient(app).snapshots['2026-03-22'].$get()
    expect(res.status).toBe(200)
  })

  it('returns 404 when snapshot does not exist', async () => {
    vi.mocked(repo.getSnapshotByDate).mockResolvedValue(null)
    const res = await testClient(app).snapshots['2099-01-01'].$get()
    expect(res.status).toBe(404)
  })
})

describe('POST /snapshots/rebuild/:date', () => {
  it('calls dailySnapshotJob and returns rebuilt count', async () => {
    vi.mocked(dailySnapshotJob).mockResolvedValue()
    const res = await testClient(app).snapshots.rebuild['2026-03-22'].$post()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rebuilt).toBe(1)
  })
})

describe('POST /snapshots/rebuild-range', () => {
  it('calls dailySnapshotJob once per date in range', async () => {
    vi.mocked(dailySnapshotJob).mockResolvedValue()
    const res = await testClient(app).snapshots['rebuild-range'].$post({
      json: { from: '2026-03-20', to: '2026-03-22' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rebuilt).toBe(3)
    expect(dailySnapshotJob).toHaveBeenCalledTimes(3)
  })

  it('returns 400 if from > to', async () => {
    const res = await testClient(app).snapshots['rebuild-range'].$post({
      json: { from: '2026-03-25', to: '2026-03-20' },
    })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run vitest — confirm FAIL**

- [ ] **Step 3: Implement repository**

```ts
// api/src/modules/snapshots/snapshots.repository.ts
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { assets, accounts, snapshotItems } from '../../../db/schema'
import type { DrizzleDB } from '../../../db/client'

type RangeParam = '30d' | '1y' | 'all'

function rangeToDate(range: RangeParam): string | null {
  if (range === '30d') return new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
  if (range === '1y')  return new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10)
  return null  // 'all' — no lower bound
}

export async function getSnapshotHistory(db: DrizzleDB, range: RangeParam) {
  const cutoff = rangeToDate(range)
  const base = db
    .select({
      snapshotDate: snapshotItems.snapshotDate,
      netWorth: sql<string>`SUM(CASE WHEN ${assets.assetClass}='liability' THEN -${snapshotItems.valueInBase} ELSE ${snapshotItems.valueInBase} END)`.as('netWorth'),
    })
    .from(snapshotItems)
    .innerJoin(assets, eq(snapshotItems.assetId, assets.id))
    .groupBy(snapshotItems.snapshotDate)
    .orderBy(desc(snapshotItems.snapshotDate))

  return cutoff
    ? base.where(gte(snapshotItems.snapshotDate, cutoff))
    : base
}

export async function getSnapshotItemsByAsset(db: DrizzleDB, assetId: string, range: RangeParam) {
  const cutoff = rangeToDate(range)
  const base = db
    .select({
      snapshotDate: snapshotItems.snapshotDate,
      valueInBase: sql<string>`SUM(${snapshotItems.valueInBase})`.as('valueInBase'),
    })
    .from(snapshotItems)
    .where(eq(snapshotItems.assetId, assetId))
    .groupBy(snapshotItems.snapshotDate)
    .orderBy(desc(snapshotItems.snapshotDate))

  return cutoff
    ? base.where(and(eq(snapshotItems.assetId, assetId), gte(snapshotItems.snapshotDate, cutoff)))
    : base
}

export async function getSnapshotByDate(db: DrizzleDB, date: string) {
  const rows = await db
    .select({
      snapshotDate: snapshotItems.snapshotDate,
      assetId: snapshotItems.assetId, accountId: snapshotItems.accountId,
      assetName: assets.name, accountName: accounts.name,
      assetClass: assets.assetClass, category: assets.category,
      quantity: snapshotItems.quantity, price: snapshotItems.price,
      currencyCode: assets.currencyCode, fxRate: snapshotItems.fxRate,
      valueInBase: snapshotItems.valueInBase,
    })
    .from(snapshotItems)
    .innerJoin(assets, eq(snapshotItems.assetId, assets.id))
    .innerJoin(accounts, eq(snapshotItems.accountId, accounts.id))
    .where(eq(snapshotItems.snapshotDate, date))

  if (!rows.length) return null

  const netWorth = rows.reduce((sum, r) => {
    const v = Number(r.valueInBase)
    return sum + (r.assetClass === 'liability' ? -v : v)
  }, 0)

  return { snapshotDate: date, netWorth, items: rows }
}
```

- [ ] **Step 3 (continued): Implement service**

```ts
// api/src/modules/snapshots/snapshots.service.ts
import { db } from '../../../db/client'
import { dailySnapshotJob } from '../../jobs/snapshot.job'
import * as repo from './snapshots.repository'

type RangeParam = '30d' | '1y' | 'all'

export async function listHistory(range: RangeParam) {
  return repo.getSnapshotHistory(db, range)
}

export async function listItemsByAsset(assetId: string, range: RangeParam) {
  return repo.getSnapshotItemsByAsset(db, assetId, range)
}

export async function getDetail(date: string) {
  return repo.getSnapshotByDate(db, date)
}

export async function rebuildDate(date: string) {
  await dailySnapshotJob(db, new Date(date))
  return { rebuilt: 1, missingAssets: [] as string[] }
}

export async function rebuildRange(from: string, to: string) {
  const dates: string[] = []
  const current = new Date(from)
  const end = new Date(to)
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setDate(current.getDate() + 1)
  }
  for (const date of dates) {
    await dailySnapshotJob(db, new Date(date))
  }
  return { rebuilt: dates.length, missingAssets: [] as string[] }
}
```

- [ ] **Step 3 (continued): Implement controller**

```ts
// api/src/modules/snapshots/snapshots.controller.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import * as service from './snapshots.service'

const rangeSchema = z.enum(['30d', '1y', 'all']).default('30d')

export const snapshotsRouter = new Hono()

snapshotsRouter.get('/history',
  zValidator('query', z.object({ range: rangeSchema })),
  async (c) => {
    const { range } = c.req.valid('query')
    const rows = await service.listHistory(range)
    return c.json(rows.map(r => ({ snapshotDate: r.snapshotDate, netWorth: r.netWorth })))
  }
)

snapshotsRouter.get('/items',
  zValidator('query', z.object({ assetId: z.string().uuid(), range: rangeSchema })),
  async (c) => {
    const { assetId, range } = c.req.valid('query')
    const rows = await service.listItemsByAsset(assetId, range)
    return c.json(rows.map(r => ({ snapshotDate: r.snapshotDate, valueInBase: r.valueInBase })))
  }
)

snapshotsRouter.get('/:date',
  zValidator('param', z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })),
  async (c) => {
    const { date } = c.req.valid('param')
    const detail = await service.getDetail(date)
    if (!detail) return c.json({ error: 'Not found' }, 404)
    return c.json(detail)
  }
)

snapshotsRouter.post('/rebuild/:date',
  zValidator('param', z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })),
  async (c) => {
    const { date } = c.req.valid('param')
    const result = await service.rebuildDate(date)
    return c.json(result)
  }
)

snapshotsRouter.post('/rebuild-range',
  zValidator('json', z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).refine(d => d.from <= d.to, { message: 'from must be ≤ to' })),
  async (c) => {
    const { from, to } = c.req.valid('json')
    const result = await service.rebuildRange(from, to)
    return c.json(result)
  }
)
```

- [ ] **Step 4: Run vitest — confirm PASS**

- [ ] **Step 5: Commit**

```bash
git add api/src/modules/snapshots/ api/tests/snapshots-api.test.ts
git commit -m "feat: add snapshots repository, service, and controller (5 endpoints)"
```

---

## Task 6: Dashboard Repository + Service — Summary Endpoint

**Files:**
- Create: `api/src/modules/dashboard/dashboard.repository.ts`
- Create: `api/src/modules/dashboard/dashboard.service.ts`
- Create: `api/src/modules/dashboard/dashboard.controller.ts`
- Test: `api/tests/dashboard.test.ts`

### Overview

`GET /dashboard/summary?displayCurrency=TWD` returns the latest snapshot's net worth, total assets, total liabilities, change from previous snapshot, and any assets with missing prices. Display currency conversion: `displayed = valueInBase_TWD ÷ fxRate(displayCurrency→TWD, latest date)`.

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/dashboard.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { testClient } from 'hono/testing'
import { app } from '../src/index'

vi.mock('../src/modules/dashboard/dashboard.repository', () => ({
  getLatestSnapshotDate: vi.fn(),
  getSummaryForDate: vi.fn(),
  getPreviousSummary: vi.fn(),
  getFxRateForDisplay: vi.fn(),
  getAllocationForDate: vi.fn(),
  getNetWorthHistory: vi.fn(),
}))

import * as repo from '../src/modules/dashboard/dashboard.repository'

describe('GET /dashboard/summary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with correct netWorth and change fields', async () => {
    vi.mocked(repo.getLatestSnapshotDate).mockResolvedValue('2026-03-22')
    vi.mocked(repo.getSummaryForDate).mockResolvedValue({
      totalAssets: '13199320.00', totalLiabilities: '352000.00',
    })
    vi.mocked(repo.getPreviousSummary).mockResolvedValue({ netWorth: '12558320.00' })
    vi.mocked(repo.getFxRateForDisplay).mockResolvedValue(1.0)

    const res = await testClient(app).dashboard.summary.$get({ query: { displayCurrency: 'TWD' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.snapshotDate).toBe('2026-03-22')
    expect(body.netWorth).toBeCloseTo(13199320 - 352000)
    expect(body.changeAmount).not.toBeNull()
    expect(body.changePct).not.toBeNull()
  })

  it('returns null change fields when no previous snapshot exists', async () => {
    vi.mocked(repo.getLatestSnapshotDate).mockResolvedValue('2026-03-22')
    vi.mocked(repo.getSummaryForDate).mockResolvedValue({
      totalAssets: '5000000.00', totalLiabilities: '0.00',
    })
    vi.mocked(repo.getPreviousSummary).mockResolvedValue(null)
    vi.mocked(repo.getFxRateForDisplay).mockResolvedValue(1.0)

    const res = await testClient(app).dashboard.summary.$get({ query: { displayCurrency: 'TWD' } })
    const body = await res.json()
    expect(body.changeAmount).toBeNull()
    expect(body.changePct).toBeNull()
  })

  it('returns 404 when no snapshots exist at all', async () => {
    vi.mocked(repo.getLatestSnapshotDate).mockResolvedValue(null)
    const res = await testClient(app).dashboard.summary.$get({ query: { displayCurrency: 'TWD' } })
    expect(res.status).toBe(404)
  })

  it('applies display currency conversion', async () => {
    vi.mocked(repo.getLatestSnapshotDate).mockResolvedValue('2026-03-22')
    vi.mocked(repo.getSummaryForDate).mockResolvedValue({
      totalAssets: '3250000.00', totalLiabilities: '0.00',
    })
    vi.mocked(repo.getPreviousSummary).mockResolvedValue(null)
    // 1 USD = 32.5 TWD, so displayed = 3250000 / 32.5 = 100000 USD
    vi.mocked(repo.getFxRateForDisplay).mockResolvedValue(32.5)

    const res = await testClient(app).dashboard.summary.$get({ query: { displayCurrency: 'USD' } })
    const body = await res.json()
    expect(body.netWorth).toBeCloseTo(100000)
    expect(body.displayCurrency).toBe('USD')
  })
})
```

- [ ] **Step 2: Run vitest — confirm FAIL**

- [ ] **Step 3: Implement repository (summary queries)**

```ts
// api/src/modules/dashboard/dashboard.repository.ts
import { and, desc, eq, lt, max, sql } from 'drizzle-orm'
import { assets, fxRates, snapshotItems } from '../../../db/schema'
import type { DrizzleDB } from '../../../db/client'

export async function getLatestSnapshotDate(db: DrizzleDB): Promise<string | null> {
  const rows = await db.select({ d: max(snapshotItems.snapshotDate) }).from(snapshotItems)
  return rows[0]?.d ?? null
}

export async function getSummaryForDate(db: DrizzleDB, date: string) {
  const rows = await db
    .select({
      assetClass: assets.assetClass,
      total: sql<string>`SUM(${snapshotItems.valueInBase})`.as('total'),
    })
    .from(snapshotItems)
    .innerJoin(assets, eq(snapshotItems.assetId, assets.id))
    .where(eq(snapshotItems.snapshotDate, date))
    .groupBy(assets.assetClass)

  const totalAssets = rows.find(r => r.assetClass === 'asset')?.total ?? '0'
  const totalLiabilities = rows.find(r => r.assetClass === 'liability')?.total ?? '0'
  return { totalAssets, totalLiabilities }
}

export async function getPreviousSummary(db: DrizzleDB, beforeDate: string) {
  const prev = await db
    .select({ d: max(snapshotItems.snapshotDate) })
    .from(snapshotItems)
    .where(lt(snapshotItems.snapshotDate, beforeDate))
  const prevDate = prev[0]?.d
  if (!prevDate) return null

  const rows = await db
    .select({
      assetClass: assets.assetClass,
      total: sql<string>`SUM(${snapshotItems.valueInBase})`.as('total'),
    })
    .from(snapshotItems)
    .innerJoin(assets, eq(snapshotItems.assetId, assets.id))
    .where(eq(snapshotItems.snapshotDate, prevDate))
    .groupBy(assets.assetClass)

  const totalAssets = Number(rows.find(r => r.assetClass === 'asset')?.total ?? 0)
  const totalLiabilities = Number(rows.find(r => r.assetClass === 'liability')?.total ?? 0)
  return { netWorth: String(totalAssets - totalLiabilities) }
}

export async function getFxRateForDisplay(
  db: DrizzleDB, displayCurrency: string, date: string
): Promise<number> {
  if (displayCurrency === 'TWD') return 1.0
  const rows = await db
    .select({ rate: fxRates.rate })
    .from(fxRates)
    .where(and(eq(fxRates.fromCurrency, displayCurrency), eq(fxRates.toCurrency, 'TWD')))
    .orderBy(desc(fxRates.rateDate))
    .limit(1)
  return rows.length ? Number(rows[0].rate) : 1.0
}
```

- [ ] **Step 3 (continued): Implement service (summary)**

```ts
// api/src/modules/dashboard/dashboard.service.ts  (summary section)
import { db } from '../../../db/client'
import * as repo from './dashboard.repository'

const VALID_CURRENCIES = ['TWD', 'USD', 'JPY'] as const
type DisplayCurrency = typeof VALID_CURRENCIES[number]

export async function getSummary(displayCurrency: DisplayCurrency) {
  const latestDate = await repo.getLatestSnapshotDate(db)
  if (!latestDate) return null

  const { totalAssets, totalLiabilities } = await repo.getSummaryForDate(db, latestDate)
  const fxRate = await repo.getFxRateForDisplay(db, displayCurrency, latestDate)
  const prevSummary = await repo.getPreviousSummary(db, latestDate)

  const netWorthTWD = Number(totalAssets) - Number(totalLiabilities)
  const netWorth = netWorthTWD / fxRate

  let changeAmount: number | null = null
  let changePct: number | null = null
  if (prevSummary) {
    const prevNet = Number(prevSummary.netWorth) / fxRate
    changeAmount = netWorth - prevNet
    changePct = prevNet !== 0 ? (changeAmount / prevNet) * 100 : null
  }

  return {
    snapshotDate: latestDate,
    displayCurrency,
    netWorth: Math.round(netWorth * 100) / 100,
    totalAssets: Math.round(Number(totalAssets) / fxRate * 100) / 100,
    totalLiabilities: Math.round(Number(totalLiabilities) / fxRate * 100) / 100,
    changeAmount: changeAmount !== null ? Math.round(changeAmount * 100) / 100 : null,
    changePct: changePct !== null ? Math.round(changePct * 100) / 100 : null,
    missingAssets: [] as string[],  // TODO: derive from holdings without recent snapshot entry
  }
}
```

- [ ] **Step 3 (continued): Implement controller (summary route only)**

```ts
// api/src/modules/dashboard/dashboard.controller.ts  (summary route)
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import * as service from './dashboard.service'

const displayCurrencySchema = z.enum(['TWD', 'USD', 'JPY']).default('TWD')

export const dashboardRouter = new Hono()

dashboardRouter.get('/summary',
  zValidator('query', z.object({ displayCurrency: displayCurrencySchema })),
  async (c) => {
    const { displayCurrency } = c.req.valid('query')
    const summary = await service.getSummary(displayCurrency)
    if (!summary) return c.json({ error: 'No snapshot data available' }, 404)
    return c.json(summary)
  }
)
```

- [ ] **Step 4: Run vitest — confirm PASS**

- [ ] **Step 5: Commit**

```bash
git add api/src/modules/dashboard/ api/tests/dashboard.test.ts
git commit -m "feat: add dashboard repository, service, and summary endpoint"
```

---

## Task 7: Dashboard Service — Allocation Endpoint

**Files:**
- Edit: `api/src/modules/dashboard/dashboard.repository.ts`
- Edit: `api/src/modules/dashboard/dashboard.service.ts`
- Edit: `api/src/modules/dashboard/dashboard.controller.ts`
- Test: `api/tests/dashboard.test.ts` (allocation section, appended)

### Overview

`GET /dashboard/allocation?date=&displayCurrency=TWD` returns a Treemap-ready structure grouped by `category`. If `date` is omitted, use the latest snapshot date. Each category entry includes a list of individual asset items with their share percentage. Liabilities are excluded from percentage calculation for the Treemap (category `debt` is shown separately).

Category display labels and colors must match the spec:

| category | label | color |
|---|---|---|
| `liquid` | 流動資金 | `#078080` |
| `investment` | 投資 | `#7c3aed` |
| `fixed` | 固定資產 | `#1d4ed8` |
| `receivable` | 應收款 | `#f59e0b` |
| `debt` | 負債 | `#f45d48` |

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/dashboard.test.ts  — allocation section (append)
describe('GET /dashboard/allocation', () => {
  it('returns categories with items and percentage', async () => {
    vi.mocked(repo.getLatestSnapshotDate).mockResolvedValue('2026-03-22')
    vi.mocked(repo.getAllocationForDate).mockResolvedValue([
      { category: 'investment', assetId: 'uuid-aapl', name: 'AAPL', valueInBase: '87320.00' },
      { category: 'liquid', assetId: 'uuid-cash', name: '郵局帳戶', valueInBase: '500000.00' },
    ])
    vi.mocked(repo.getFxRateForDisplay).mockResolvedValue(1.0)

    const res = await testClient(app).dashboard.allocation.$get({
      query: { displayCurrency: 'TWD' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.categories).toHaveLength(2)
    const investment = body.categories.find((c: any) => c.category === 'investment')
    expect(investment?.color).toBe('#7c3aed')
    expect(investment?.items[0].name).toBe('AAPL')
    expect(investment?.pct).toBeCloseTo((87320 / (87320 + 500000)) * 100, 1)
  })
})
```

- [ ] **Step 2: Run vitest — confirm FAIL**

- [ ] **Step 3: Add `getAllocationForDate` to repository**

```ts
// append to dashboard.repository.ts
export async function getAllocationForDate(db: DrizzleDB, date: string) {
  return db
    .select({
      category: assets.category,
      assetId: snapshotItems.assetId,
      name: assets.name,
      valueInBase: sql<string>`SUM(${snapshotItems.valueInBase})`.as('valueInBase'),
    })
    .from(snapshotItems)
    .innerJoin(assets, eq(snapshotItems.assetId, assets.id))
    .where(eq(snapshotItems.snapshotDate, date))
    .groupBy(assets.category, snapshotItems.assetId, assets.name)
    .orderBy(desc(sql`SUM(${snapshotItems.valueInBase})`))
}
```

- [ ] **Step 3 (continued): Add `getAllocation` to service**

```ts
// append to dashboard.service.ts
const CATEGORY_META: Record<string, { label: string; color: string }> = {
  liquid:     { label: '流動資金', color: '#078080' },
  investment: { label: '投資',     color: '#7c3aed' },
  fixed:      { label: '固定資產', color: '#1d4ed8' },
  receivable: { label: '應收款',   color: '#f59e0b' },
  debt:       { label: '負債',     color: '#f45d48' },
}

export async function getAllocation(date: string | undefined, displayCurrency: DisplayCurrency) {
  const snapshotDate = date ?? await repo.getLatestSnapshotDate(db)
  if (!snapshotDate) return null

  const rows = await repo.getAllocationForDate(db, snapshotDate)
  const fxRate = await repo.getFxRateForDisplay(db, displayCurrency, snapshotDate)
  const totalValue = rows.reduce((s, r) => s + Number(r.valueInBase), 0)

  // Group by category
  const grouped = new Map<string, typeof rows>()
  for (const row of rows) {
    if (!grouped.has(row.category)) grouped.set(row.category, [])
    grouped.get(row.category)!.push(row)
  }

  const categories = [...grouped.entries()].map(([cat, items]) => {
    const catValue = items.reduce((s, i) => s + Number(i.valueInBase), 0)
    const meta = CATEGORY_META[cat] ?? { label: cat, color: '#888' }
    return {
      category: cat,
      label: meta.label,
      value: Math.round(catValue / fxRate * 100) / 100,
      pct: totalValue > 0 ? Math.round((catValue / totalValue) * 10000) / 100 : 0,
      color: meta.color,
      items: items.map(i => ({
        assetId: i.assetId,
        name: i.name,
        value: Math.round(Number(i.valueInBase) / fxRate * 100) / 100,
        pct: totalValue > 0 ? Math.round((Number(i.valueInBase) / totalValue) * 10000) / 100 : 0,
      })),
    }
  })

  return { snapshotDate, displayCurrency, categories }
}
```

- [ ] **Step 3 (continued): Add allocation route to controller**

```ts
// append to dashboard.controller.ts
dashboardRouter.get('/allocation',
  zValidator('query', z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    displayCurrency: displayCurrencySchema,
  })),
  async (c) => {
    const { date, displayCurrency } = c.req.valid('query')
    const result = await service.getAllocation(date, displayCurrency)
    if (!result) return c.json({ error: 'No snapshot data available' }, 404)
    return c.json(result)
  }
)
```

- [ ] **Step 4: Run vitest — confirm PASS**

- [ ] **Step 5: Commit**

```bash
git add api/src/modules/dashboard/ api/tests/dashboard.test.ts
git commit -m "feat: add dashboard allocation endpoint with Treemap-ready category grouping"
```

---

## Task 8: Dashboard Service — Net-Worth-History + Wire Up Controller

**Files:**
- Edit: `api/src/modules/dashboard/dashboard.repository.ts`
- Edit: `api/src/modules/dashboard/dashboard.service.ts`
- Edit: `api/src/modules/dashboard/dashboard.controller.ts`
- Edit: `api/src/index.ts`
- Test: `api/tests/dashboard.test.ts` (history section, appended)

### Overview

`GET /dashboard/net-worth-history?range=30d|1y|all&displayCurrency=TWD` queries `snapshotItems` grouped by date, applies the `CASE WHEN liability` sign convention, and converts to display currency. Wire up `dashboardRouter` in `index.ts` under the `/dashboard` prefix.

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/dashboard.test.ts  — net-worth-history section (append)
describe('GET /dashboard/net-worth-history', () => {
  it('returns data array with correct netWorth per date', async () => {
    vi.mocked(repo.getNetWorthHistory).mockResolvedValue([
      { snapshotDate: '2026-03-21', netWorth: '12558320.00' },
      { snapshotDate: '2026-03-22', netWorth: '12847320.00' },
    ])
    vi.mocked(repo.getFxRateForDisplay).mockResolvedValue(32.5)
    vi.mocked(repo.getLatestSnapshotDate).mockResolvedValue('2026-03-22')

    const res = await testClient(app).dashboard['net-worth-history'].$get({
      query: { range: '30d', displayCurrency: 'USD' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.displayCurrency).toBe('USD')
    expect(body.data).toHaveLength(2)
    expect(body.data[0].netWorth).toBeCloseTo(12558320 / 32.5, 0)
    expect(body.data[1].netWorth).toBeCloseTo(12847320 / 32.5, 0)
  })

  it('returns 400 for invalid range', async () => {
    const res = await testClient(app).dashboard['net-worth-history'].$get({
      query: { range: 'bad' },
    })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run vitest — confirm FAIL**

- [ ] **Step 3: Add `getNetWorthHistory` to repository**

```ts
// append to dashboard.repository.ts
export async function getNetWorthHistory(db: DrizzleDB, range: '30d' | '1y' | 'all') {
  const cutoffs: Record<string, string | null> = {
    '30d': new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10),
    '1y':  new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10),
    'all': null,
  }
  const cutoff = cutoffs[range]

  const base = db
    .select({
      snapshotDate: snapshotItems.snapshotDate,
      netWorth: sql<string>`SUM(CASE WHEN ${assets.assetClass}='liability' THEN -${snapshotItems.valueInBase} ELSE ${snapshotItems.valueInBase} END)`.as('netWorth'),
    })
    .from(snapshotItems)
    .innerJoin(assets, eq(snapshotItems.assetId, assets.id))
    .groupBy(snapshotItems.snapshotDate)
    .orderBy(snapshotItems.snapshotDate)

  return cutoff ? base.where(gte(snapshotItems.snapshotDate, cutoff)) : base
}
```

- [ ] **Step 3 (continued): Add `getNetWorthHistoryData` to service**

```ts
// append to dashboard.service.ts
export async function getNetWorthHistoryData(range: '30d' | '1y' | 'all', displayCurrency: DisplayCurrency) {
  const rows = await repo.getNetWorthHistory(db, range)
  const latestDate = rows.length ? rows[rows.length - 1].snapshotDate : null
  const fxRate = latestDate ? await repo.getFxRateForDisplay(db, displayCurrency, latestDate) : 1.0

  return {
    displayCurrency,
    data: rows.map(r => ({
      date: r.snapshotDate,
      netWorth: Math.round(Number(r.netWorth) / fxRate * 100) / 100,
    })),
  }
}
```

- [ ] **Step 3 (continued): Add history route + finalize controller**

```ts
// append to dashboard.controller.ts
dashboardRouter.get('/net-worth-history',
  zValidator('query', z.object({
    range: z.enum(['30d', '1y', 'all']).default('30d'),
    displayCurrency: displayCurrencySchema,
  })),
  async (c) => {
    const { range, displayCurrency } = c.req.valid('query')
    const result = await service.getNetWorthHistoryData(range, displayCurrency)
    return c.json(result)
  }
)
```

- [ ] **Step 3 (continued): Wire up router in `api/src/index.ts`**

```ts
// api/src/index.ts  — add after existing route registrations
import { snapshotsRouter } from './modules/snapshots/snapshots.controller'
import { dashboardRouter } from './modules/dashboard/dashboard.controller'

app.route('/api/v1/snapshots', snapshotsRouter)
app.route('/api/v1/dashboard', dashboardRouter)
```

- [ ] **Step 4: Run full test suite — confirm all PASS**

```bash
cd api && npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add api/src/modules/dashboard/ api/src/index.ts api/tests/dashboard.test.ts
git commit -m "feat: add dashboard net-worth-history endpoint and wire up all routers"
```

---

## Completion Checklist

- [ ] All 3 test files pass: `snapshot-job.test.ts`, `snapshots-api.test.ts`, `dashboard.test.ts`
- [ ] `POST /snapshots/trigger` works end-to-end against a real DB (manual smoke test)
- [ ] `GET /dashboard/summary` returns correct TWD/USD/JPY values
- [ ] `GET /dashboard/allocation` returns Treemap-ready `categories` array with colors
- [ ] `GET /dashboard/net-worth-history?range=all` returns the full history series
- [ ] node-cron schedule confirmed in logs at startup (`SNAPSHOT_SCHEDULE=0 22 * * *`)
- [ ] Snapshot rebuild-range of 3 dates completes and returns `{rebuilt: 3}`
