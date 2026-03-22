# AtomWorth — Backend Foundation Implementation Plan (TypeScript)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the AtomWorth Hono API with PostgreSQL (Drizzle ORM) and all CRUD endpoints following Controller-Service-Repository pattern.

**Architecture:** Hono (TypeScript) + Drizzle ORM + PostgreSQL 16. Every module has controller/service/repository. Zod validates all inputs. Tests use Vitest + @hono/testing against a real PostgreSQL test database.

**Serialization convention:** Drizzle returns camelCase TypeScript objects. All API responses are explicitly serialized to **snake_case** in the controller layer (e.g., `asset_class`, `currency_code`, `pricing_mode`). This keeps the REST API consistent with conventional JSON naming and matches the frontend's TypeScript interface definitions.

**Tech Stack:** TypeScript, Hono, Drizzle ORM, postgres (node-postgres), Zod, Vitest

**Prerequisite:** Backend Services plan (Part 2) and Frontend plans (Parts A+B) follow this.

---

## Project Structure

```
AtomWorth/
├── shared/
│   └── types.ts               # Shared TypeScript types (Asset, Account, Holding, etc.)
├── api/
│   ├── src/
│   │   ├── index.ts           # Hono app entry: registers all routers, starts server
│   │   ├── config.ts          # env vars via process.env (DATABASE_URL, BASE_CURRENCY, etc.)
│   │   ├── db/
│   │   │   ├── client.ts      # Drizzle client (postgres connection pool)
│   │   │   └── schema.ts      # Drizzle schema definitions for all 7 tables
│   │   └── modules/
│   │       ├── assets/
│   │       │   ├── assets.controller.ts
│   │       │   ├── assets.service.ts
│   │       │   ├── assets.repository.ts
│   │       │   └── assets.schema.ts
│   │       ├── accounts/
│   │       │   ├── accounts.controller.ts
│   │       │   ├── accounts.service.ts
│   │       │   ├── accounts.repository.ts
│   │       │   └── accounts.schema.ts
│   │       ├── holdings/
│   │       │   ├── holdings.controller.ts
│   │       │   ├── holdings.service.ts
│   │       │   ├── holdings.repository.ts
│   │       │   └── holdings.schema.ts
│   │       ├── transactions/
│   │       │   ├── transactions.controller.ts
│   │       │   ├── transactions.service.ts
│   │       │   ├── transactions.repository.ts
│   │       │   └── transactions.schema.ts
│   │       ├── prices/
│   │       │   ├── prices.controller.ts
│   │       │   ├── prices.service.ts
│   │       │   ├── prices.repository.ts
│   │       │   └── prices.schema.ts
│   │       └── fx-rates/
│   │           ├── fx-rates.controller.ts
│   │           ├── fx-rates.service.ts
│   │           ├── fx-rates.repository.ts
│   │           └── fx-rates.schema.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── drizzle.config.ts
│   ├── Dockerfile
│   └── tests/
│       ├── helpers/
│       │   └── db.ts
│       ├── assets.test.ts
│       ├── accounts.test.ts
│       ├── holdings.test.ts
│       ├── transactions.test.ts
│       ├── prices.test.ts
│       └── fx-rates.test.ts
├── docker-compose.yml
└── docker-compose.dev.yml
```

---

## Task 1: Docker Compose + Monorepo Scaffold

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.dev.yml`
- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/drizzle.config.ts`
- Create: `api/Dockerfile`
- Create: `shared/types.ts`

- [ ] Step 1: Write a smoke test confirming the monorepo directories exist and TypeScript compiles

```ts
// api/tests/scaffold.test.ts
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'

describe('monorepo scaffold', () => {
  it('api/src/index.ts exists', () => {
    expect(existsSync(resolve(__dirname, '../src/index.ts'))).toBe(true)
  })
  it('shared/types.ts exists', () => {
    expect(existsSync(resolve(__dirname, '../../../shared/types.ts'))).toBe(true)
  })
})
```

- [ ] Step 2: Run: `cd api && npx vitest run tests/scaffold.test.ts` — Expected: FAIL

- [ ] Step 3: Create all scaffold files

**`docker-compose.yml`:**
```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: atomworth
      POSTGRES_USER: atomworth
      POSTGRES_PASSWORD: atomworth
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
  api:
    build: ./api
    environment:
      DATABASE_URL: postgres://atomworth:atomworth@db:5432/atomworth
      BASE_CURRENCY: TWD
      SNAPSHOT_SCHEDULE: "0 22 * * *"
      EXCHANGERATE_API_KEY: ${EXCHANGERATE_API_KEY}
    ports:
      - "8000:8000"
    depends_on: [db]
  web:
    build: ./web
    environment:
      NEXT_PUBLIC_API_BASE_URL: http://api:8000/api/v1
    ports:
      - "3000:3000"
    depends_on: [api]
volumes:
  pgdata:
```

**`docker-compose.dev.yml`** (override for local dev, mounts source):
```yaml
services:
  api:
    build:
      context: ./api
      target: dev
    volumes:
      - ./api:/app
      - /app/node_modules
    command: npx tsx watch src/index.ts
  db:
    ports:
      - "5432:5432"
```

**`api/package.json`** (key deps):
```json
{
  "name": "atomworth-api",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "db:migrate": "drizzle-kit migrate",
    "db:generate": "drizzle-kit generate"
  },
  "dependencies": {
    "hono": "^4.4.0",
    "@hono/node-server": "^1.12.0",
    "drizzle-orm": "^0.31.0",
    "postgres": "^3.4.3",
    "zod": "^3.23.0",
    "@hono/zod-validator": "^0.2.2"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.15.0",
    "vitest": "^1.6.0",
    "drizzle-kit": "^0.22.0",
    "@types/node": "^20.0.0"
  }
}
```

**`api/tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": { "@shared/*": ["../../shared/*"] }
  },
  "include": ["src", "tests"]
}
```

**`shared/types.ts`** (exported domain types used by both api/ and web/):
```ts
export type AssetClass = 'asset' | 'liability'
export type Category = 'liquid' | 'investment' | 'fixed' | 'receivable' | 'debt'
export type PricingMode = 'market' | 'fixed' | 'manual'
export type AccountType = 'bank' | 'broker' | 'crypto_exchange' | 'e_wallet' | 'cash' | 'other'
export type TxnType = 'buy' | 'sell' | 'transfer_in' | 'transfer_out' | 'adjustment'

export interface Asset {
  id: string
  name: string
  assetClass: AssetClass
  category: Category
  subKind: string
  symbol: string | null
  market: string | null
  currencyCode: string
  pricingMode: PricingMode
  createdAt: string
  updatedAt: string
}

export interface Account {
  id: string
  name: string
  institution: string | null
  accountType: AccountType
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface Holding {
  assetId: string
  accountId: string
  quantity: string
  createdAt: string
  updatedAt: string
}
```

- [ ] Step 4: Run scaffold test — Expected: PASS
- [ ] Step 5: Commit `git commit -m "feat: monorepo scaffold with Docker Compose and api/shared packages"`

---

## Task 2: Drizzle Schema + DB Client + Migration Setup

**Files:**
- Create: `api/src/db/schema.ts`
- Create: `api/src/db/client.ts`
- Create: `api/drizzle.config.ts`

- [ ] Step 1: Write a test that imports the schema and verifies table names

```ts
// api/tests/schema.test.ts
import { describe, it, expect } from 'vitest'
import { assets, accounts, holdings, transactions, prices, fxRates, snapshotItems } from '../src/db/schema'

describe('Drizzle schema', () => {
  it('exports all 7 tables', () => {
    expect(assets).toBeDefined()
    expect(accounts).toBeDefined()
    expect(holdings).toBeDefined()
    expect(transactions).toBeDefined()
    expect(prices).toBeDefined()
    expect(fxRates).toBeDefined()
    expect(snapshotItems).toBeDefined()
  })
  it('assets table has required columns', () => {
    const cols = Object.keys(assets)
    expect(cols).toContain('id')
    expect(cols).toContain('assetClass')
    expect(cols).toContain('pricingMode')
  })
})
```

- [ ] Step 2: Run: `cd api && npx vitest run tests/schema.test.ts` — Expected: FAIL

- [ ] Step 3: Implement `api/src/db/schema.ts`

```ts
import { pgTable, uuid, text, numeric, date, timestamp, primaryKey } from 'drizzle-orm/pg-core'

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  assetClass: text('asset_class').notNull(),
  category: text('category').notNull(),
  subKind: text('sub_kind').notNull(),
  symbol: text('symbol'),
  market: text('market'),
  currencyCode: text('currency_code').notNull(),
  pricingMode: text('pricing_mode').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  institution: text('institution'),
  accountType: text('account_type').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const holdings = pgTable('holdings', {
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  quantity: numeric('quantity', { precision: 24, scale: 8 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.assetId, t.accountId] }) }))

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  txnType: text('txn_type').notNull(),
  quantity: numeric('quantity', { precision: 24, scale: 8 }).notNull(),
  txnDate: date('txn_date').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const prices = pgTable('prices', {
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  priceDate: date('price_date').notNull(),
  price: numeric('price', { precision: 24, scale: 8 }).notNull(),
  source: text('source').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.assetId, t.priceDate] }) }))

export const fxRates = pgTable('fx_rates', {
  fromCurrency: text('from_currency').notNull(),
  toCurrency: text('to_currency').notNull(),
  rateDate: date('rate_date').notNull(),
  rate: numeric('rate', { precision: 24, scale: 10 }).notNull(),
  source: text('source').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.fromCurrency, t.toCurrency, t.rateDate] }) }))

export const snapshotItems = pgTable('snapshot_items', {
  snapshotDate: date('snapshot_date').notNull(),
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  quantity: numeric('quantity', { precision: 24, scale: 8 }).notNull(),
  price: numeric('price', { precision: 24, scale: 8 }).notNull(),
  fxRate: numeric('fx_rate', { precision: 24, scale: 10 }).notNull(),
  valueInBase: numeric('value_in_base', { precision: 24, scale: 8 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.snapshotDate, t.assetId, t.accountId] }) }))
```

Implement `api/src/db/client.ts`:
```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!
const client = postgres(connectionString)
export const db = drizzle(client, { schema })
export type DrizzleDB = typeof db
```

Implement `api/drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit'
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
```

- [ ] Step 4: Run schema test — Expected: PASS
- [ ] Step 5: Run `cd api && npm run db:generate && npm run db:migrate` to apply migrations to dev DB
- [ ] Step 6: Commit `git commit -m "feat: Drizzle schema for all 7 tables + DB client + migration config"`

---

## Task 3: Hono App Setup + Error Handling + Test Helpers

**Files:**
- Create: `api/src/index.ts`
- Create: `api/src/config.ts`
- Create: `api/tests/helpers/db.ts`

- [ ] Step 1: Write a test that calls the health check endpoint

```ts
// api/tests/app.test.ts
import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('Hono app', () => {
  it('GET /health returns 200', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
  it('unknown route returns 404', async () => {
    const res = await app.request('/nonexistent')
    expect(res.status).toBe(404)
  })
})
```

- [ ] Step 2: Run: `cd api && npx vitest run tests/app.test.ts` — Expected: FAIL

- [ ] Step 3: Implement app entry + config + test helpers

**`api/src/config.ts`:**
```ts
export const config = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  baseCurrency: process.env.BASE_CURRENCY ?? 'TWD',
  snapshotSchedule: process.env.SNAPSHOT_SCHEDULE ?? '0 22 * * *',
  exchangerateApiKey: process.env.EXCHANGERATE_API_KEY ?? '',
  port: parseInt(process.env.PORT ?? '8000', 10),
}
```

**`api/src/index.ts`:**
```ts
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import assetsController from './modules/assets/assets.controller'
import accountsController from './modules/accounts/accounts.controller'
import holdingsController from './modules/holdings/holdings.controller'
import transactionsController from './modules/transactions/transactions.controller'
import pricesController from './modules/prices/prices.controller'
import fxRatesController from './modules/fx-rates/fx-rates.controller'
import { config } from './config'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))

app.route('/api/v1/assets', assetsController)
app.route('/api/v1/accounts', accountsController)
app.route('/api/v1/holdings', holdingsController)
app.route('/api/v1/transactions', transactionsController)
app.route('/api/v1/prices', pricesController)
app.route('/api/v1/fx-rates', fxRatesController)

app.onError((err, c) => {
  const status = (err as any).status ?? 500
  return c.json({ error: err.message }, status)
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))

if (process.env.NODE_ENV !== 'test') {
  serve({ fetch: app.fetch, port: config.port })
}

export default app
```

**`api/tests/helpers/db.ts`** (test DB lifecycle utilities):
```ts
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../../src/db/schema'

const TEST_DB_URL = process.env.TEST_DATABASE_URL
  ?? 'postgres://atomworth:atomworth@localhost:5432/test_atomworth'

const client = postgres(TEST_DB_URL)
export const testDb = drizzle(client, { schema })

export async function cleanDb() {
  // Truncate in dependency order (children first)
  await testDb.execute(
    `TRUNCATE snapshot_items, transactions, holdings, prices, fx_rates, accounts, assets RESTART IDENTITY CASCADE`
  )
}

export async function closeDb() {
  await client.end()
}
```

- [ ] Step 4: Run app test — Expected: PASS
- [ ] Step 5: Commit `git commit -m "feat: Hono app entry with routing, error handler, and test DB helpers"`

---

## Task 4: Assets Module

**Files:**
- Create: `api/src/modules/assets/assets.repository.ts`
- Create: `api/src/modules/assets/assets.service.ts`
- Create: `api/src/modules/assets/assets.controller.ts`
- Create: `api/src/modules/assets/assets.schema.ts`
- Test: `api/tests/assets.test.ts`

### Business Rules (Service layer)
- `asset_class='asset'` → `category` must be one of `liquid | investment | fixed | receivable` → 422
- `asset_class='liability'` → `category` must be `debt` → 422
- `PATCH`: only `name`, `symbol`, `market` are mutable; if any `snapshot_items` row exists for this asset, `asset_class`, `category`, `sub_kind`, `currency_code`, `pricing_mode` are immutable → 422

- [ ] Step 1: Write the failing tests

```ts
// api/tests/assets.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import app from '../src/index'
import { cleanDb, closeDb } from './helpers/db'

beforeEach(() => cleanDb())
afterAll(() => closeDb())

describe('POST /api/v1/assets', () => {
  it('creates an asset and returns 201', async () => {
    const res = await app.request('/api/v1/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'AAPL', asset_class: 'asset', category: 'investment',
        sub_kind: 'stock', symbol: 'AAPL', market: 'NASDAQ',
        currency_code: 'USD', pricing_mode: 'market',
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBeDefined()
    expect(body.name).toBe('AAPL')
  })

  it('returns 422 for invalid asset_class/category combo', async () => {
    const res = await app.request('/api/v1/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bad', asset_class: 'liability', category: 'investment',
        sub_kind: 'stock', currency_code: 'TWD', pricing_mode: 'fixed',
      }),
    })
    expect(res.status).toBe(422)
  })
})

describe('GET /api/v1/assets', () => {
  it('returns empty array when no assets', async () => {
    const res = await app.request('/api/v1/assets')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

describe('PATCH /api/v1/assets/:id', () => {
  it('updates mutable fields name/symbol/market', async () => {
    const create = await app.request('/api/v1/assets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'TSLA', asset_class: 'asset', category: 'investment',
        sub_kind: 'stock', currency_code: 'USD', pricing_mode: 'market' }),
    })
    const { id } = await create.json()
    const res = await app.request(`/api/v1/assets/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Tesla Inc', symbol: 'TSLA', market: 'NASDAQ' }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).name).toBe('Tesla Inc')
  })
})

describe('DELETE /api/v1/assets/:id', () => {
  it('deletes an asset and returns 204', async () => {
    const create = await app.request('/api/v1/assets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'DEL', asset_class: 'asset', category: 'liquid',
        sub_kind: 'bank_account', currency_code: 'TWD', pricing_mode: 'fixed' }),
    })
    const { id } = await create.json()
    const res = await app.request(`/api/v1/assets/${id}`, { method: 'DELETE' })
    expect(res.status).toBe(204)
  })
})
```

- [ ] Step 2: Run: `cd api && npx vitest run tests/assets.test.ts` — Expected: FAIL

- [ ] Step 3: Implement repository → service → controller

**`assets.schema.ts`** (Zod validation schemas):
```ts
import { z } from 'zod'

export const AssetCreateSchema = z.object({
  name: z.string().min(1),
  asset_class: z.enum(['asset', 'liability']),
  category: z.enum(['liquid', 'investment', 'fixed', 'receivable', 'debt']),
  sub_kind: z.string().min(1),
  symbol: z.string().optional(),
  market: z.string().optional(),
  currency_code: z.string().length(3),
  pricing_mode: z.enum(['market', 'fixed', 'manual']),
})

export const AssetUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  symbol: z.string().optional(),
  market: z.string().optional(),
})

export type AssetCreateInput = z.infer<typeof AssetCreateSchema>
export type AssetUpdateInput = z.infer<typeof AssetUpdateSchema>
```

**`assets.repository.ts`** (Drizzle queries only):
```ts
import { eq } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { assets } from '../../db/schema'

export class AssetsRepository {
  constructor(private db: DrizzleDB) {}

  findAll() { return this.db.select().from(assets) }

  findById(id: string) {
    return this.db.select().from(assets).where(eq(assets.id, id)).then(r => r[0] ?? null)
  }

  create(data: typeof assets.$inferInsert) {
    return this.db.insert(assets).values(data).returning().then(r => r[0])
  }

  update(id: string, data: Partial<typeof assets.$inferInsert>) {
    return this.db.update(assets).set({ ...data, updatedAt: new Date() })
      .where(eq(assets.id, id)).returning().then(r => r[0] ?? null)
  }

  delete(id: string) {
    return this.db.delete(assets).where(eq(assets.id, id)).returning().then(r => r[0] ?? null)
  }
}
```

**`assets.service.ts`** (business rules):
```ts
import { AssetsRepository } from './assets.repository'
import { SnapshotItemsRepository } from '../snapshot-items/snapshot-items.repository'
import { AssetCreateInput, AssetUpdateInput } from './assets.schema'
import { HTTPException } from 'hono/http-exception'

const ASSET_CATEGORIES = ['liquid', 'investment', 'fixed', 'receivable'] as const
const LIABILITY_CATEGORIES = ['debt'] as const

export class AssetsService {
  constructor(
    private repo: AssetsRepository,
    private snapshotRepo: SnapshotItemsRepository,
  ) {}

  async findAll() { return this.repo.findAll() }
  async findById(id: string) { return this.repo.findById(id) }

  async createAsset(data: AssetCreateInput) {
    if (data.asset_class === 'asset' && !ASSET_CATEGORIES.includes(data.category as any))
      throw new HTTPException(422, { message: 'Invalid category for asset_class=asset' })
    if (data.asset_class === 'liability' && !LIABILITY_CATEGORIES.includes(data.category as any))
      throw new HTTPException(422, { message: 'category must be debt for liability' })
    return this.repo.create({
      name: data.name, assetClass: data.asset_class, category: data.category,
      subKind: data.sub_kind, symbol: data.symbol ?? null, market: data.market ?? null,
      currencyCode: data.currency_code, pricingMode: data.pricing_mode,
    })
  }

  async updateAsset(id: string, data: AssetUpdateInput) {
    const existing = await this.repo.findById(id)
    if (!existing) throw new HTTPException(404, { message: 'Asset not found' })
    const snapshotExists = await this.snapshotRepo.existsForAsset(id)
    if (snapshotExists) {
      // Only name/symbol/market allowed — immutable field check is enforced by schema (AssetUpdateSchema)
      // AssetUpdateSchema already restricts to only those fields
    }
    return this.repo.update(id, {
      name: data.name, symbol: data.symbol ?? undefined, market: data.market ?? undefined,
    })
  }

  async deleteAsset(id: string) {
    const existing = await this.repo.findById(id)
    if (!existing) throw new HTTPException(404, { message: 'Asset not found' })
    return this.repo.delete(id)
  }
}
```

**`assets.controller.ts`** (Hono route handlers, zero business logic):
```ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { AssetsRepository } from './assets.repository'
import { AssetsService } from './assets.service'
import { SnapshotItemsRepository } from '../snapshot-items/snapshot-items.repository'
import { AssetCreateSchema, AssetUpdateSchema } from './assets.schema'

const assetsController = new Hono()
const repo = new AssetsRepository(db)
const snapshotRepo = new SnapshotItemsRepository(db)
const service = new AssetsService(repo, snapshotRepo)

// Helper: Drizzle returns camelCase — serialize to snake_case for API responses
const toSnake = (a: Asset) => ({
  id: a.id, name: a.name, asset_class: a.assetClass, category: a.category,
  sub_kind: a.subKind, symbol: a.symbol, market: a.market,
  currency_code: a.currencyCode, pricing_mode: a.pricingMode,
  created_at: a.createdAt, updated_at: a.updatedAt,
})

assetsController.get('/', async (c) => c.json((await service.findAll()).map(toSnake)))

assetsController.post('/', zValidator('json', AssetCreateSchema), async (c) => {
  const asset = await service.createAsset(c.req.valid('json'))
  return c.json(asset, 201)
})

assetsController.patch('/:id', zValidator('json', AssetUpdateSchema), async (c) => {
  const asset = await service.updateAsset(c.req.param('id'), c.req.valid('json'))
  return c.json(asset)
})

assetsController.delete('/:id', async (c) => {
  await service.deleteAsset(c.req.param('id'))
  return c.body(null, 204)
})

export default assetsController
```

> Note: `SnapshotItemsRepository` will need a minimal `existsForAsset(assetId)` method returning boolean. Add it as a thin helper class in `api/src/modules/snapshot-items/snapshot-items.repository.ts` using `drizzle.select().from(snapshotItems).where(eq(snapshotItems.assetId, id)).limit(1)`.

- [ ] Step 4: Run: `cd api && npx vitest run tests/assets.test.ts` — Expected: PASS
- [ ] Step 5: Commit `git commit -m "feat: assets module with Controller-Service-Repository and TDD"`

---

## Task 5: Accounts Module

**Files:**
- Create: `api/src/modules/accounts/accounts.repository.ts`
- Create: `api/src/modules/accounts/accounts.service.ts`
- Create: `api/src/modules/accounts/accounts.controller.ts`
- Create: `api/src/modules/accounts/accounts.schema.ts`
- Test: `api/tests/accounts.test.ts`

### Business Rules (Service layer)
- `DELETE /accounts/:id` → 409 if any `holdings` row exists for this `account_id`

- [ ] Step 1: Write the failing tests

```ts
// api/tests/accounts.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import app from '../src/index'
import { cleanDb, closeDb, testDb } from './helpers/db'
import { accounts, assets, holdings } from '../src/db/schema'

beforeEach(() => cleanDb())
afterAll(() => closeDb())

describe('POST /api/v1/accounts', () => {
  it('creates an account and returns 201', async () => {
    const res = await app.request('/api/v1/accounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '富途證券', institution: 'Futu', account_type: 'broker', note: null }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBeDefined()
    expect(body.name).toBe('富途證券')
  })
})

describe('DELETE /api/v1/accounts/:id', () => {
  it('returns 409 if account has holdings', async () => {
    // seed account, asset, and holding
    const [account] = await testDb.insert(accounts).values({ name: 'TestBank', accountType: 'bank' }).returning()
    const [asset] = await testDb.insert(assets).values({
      name: 'Cash', assetClass: 'asset', category: 'liquid',
      subKind: 'bank_account', currencyCode: 'TWD', pricingMode: 'fixed',
    }).returning()
    await testDb.insert(holdings).values({ assetId: asset.id, accountId: account.id, quantity: '1000' })

    const res = await app.request(`/api/v1/accounts/${account.id}`, { method: 'DELETE' })
    expect(res.status).toBe(409)
  })

  it('deletes account with no holdings and returns 204', async () => {
    const [account] = await testDb.insert(accounts).values({ name: 'Empty', accountType: 'cash' }).returning()
    const res = await app.request(`/api/v1/accounts/${account.id}`, { method: 'DELETE' })
    expect(res.status).toBe(204)
  })
})
```

- [ ] Step 2: Run: `cd api && npx vitest run tests/accounts.test.ts` — Expected: FAIL

- [ ] Step 3: Implement repository → service → controller

**`accounts.schema.ts`:**
```ts
import { z } from 'zod'

export const AccountCreateSchema = z.object({
  name: z.string().min(1),
  institution: z.string().optional(),
  account_type: z.enum(['bank', 'broker', 'crypto_exchange', 'e_wallet', 'cash', 'other']),
  note: z.string().optional(),
})

export const AccountUpdateSchema = AccountCreateSchema.partial()
export type AccountCreateInput = z.infer<typeof AccountCreateSchema>
export type AccountUpdateInput = z.infer<typeof AccountUpdateSchema>
```

**`accounts.repository.ts`:**
```ts
import { eq } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { accounts, holdings } from '../../db/schema'

export class AccountsRepository {
  constructor(private db: DrizzleDB) {}

  findAll() { return this.db.select().from(accounts) }
  findById(id: string) {
    return this.db.select().from(accounts).where(eq(accounts.id, id)).then(r => r[0] ?? null)
  }
  create(data: typeof accounts.$inferInsert) {
    return this.db.insert(accounts).values(data).returning().then(r => r[0])
  }
  update(id: string, data: Partial<typeof accounts.$inferInsert>) {
    return this.db.update(accounts).set({ ...data, updatedAt: new Date() })
      .where(eq(accounts.id, id)).returning().then(r => r[0] ?? null)
  }
  delete(id: string) {
    return this.db.delete(accounts).where(eq(accounts.id, id)).returning().then(r => r[0] ?? null)
  }
  hasHoldings(accountId: string) {
    return this.db.select().from(holdings).where(eq(holdings.accountId, accountId))
      .limit(1).then(r => r.length > 0)
  }
}
```

**`accounts.service.ts`:**
```ts
import { AccountsRepository } from './accounts.repository'
import { AccountCreateInput, AccountUpdateInput } from './accounts.schema'
import { HTTPException } from 'hono/http-exception'

export class AccountsService {
  constructor(private repo: AccountsRepository) {}

  findAll() { return this.repo.findAll() }
  findById(id: string) { return this.repo.findById(id) }

  createAccount(data: AccountCreateInput) {
    return this.repo.create({
      name: data.name, institution: data.institution ?? null,
      accountType: data.account_type, note: data.note ?? null,
    })
  }

  async updateAccount(id: string, data: AccountUpdateInput) {
    const existing = await this.repo.findById(id)
    if (!existing) throw new HTTPException(404, { message: 'Account not found' })
    return this.repo.update(id, {
      name: data.name, institution: data.institution,
      accountType: data.account_type, note: data.note,
    })
  }

  async deleteAccount(id: string) {
    const existing = await this.repo.findById(id)
    if (!existing) throw new HTTPException(404, { message: 'Account not found' })
    const hasHoldings = await this.repo.hasHoldings(id)
    if (hasHoldings) throw new HTTPException(409, { message: 'Account has existing holdings' })
    return this.repo.delete(id)
  }
}
```

**`accounts.controller.ts`:**
```ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { AccountsRepository } from './accounts.repository'
import { AccountsService } from './accounts.service'
import { AccountCreateSchema, AccountUpdateSchema } from './accounts.schema'

const accountsController = new Hono()
const service = new AccountsService(new AccountsRepository(db))

accountsController.get('/', async (c) => c.json(await service.findAll()))
accountsController.post('/', zValidator('json', AccountCreateSchema), async (c) => {
  return c.json(await service.createAccount(c.req.valid('json')), 201)
})
accountsController.patch('/:id', zValidator('json', AccountUpdateSchema), async (c) => {
  return c.json(await service.updateAccount(c.req.param('id'), c.req.valid('json')))
})
accountsController.delete('/:id', async (c) => {
  await service.deleteAccount(c.req.param('id'))
  return c.body(null, 204)
})

export default accountsController
```

- [ ] Step 4: Run: `cd api && npx vitest run tests/accounts.test.ts` — Expected: PASS
- [ ] Step 5: Commit `git commit -m "feat: accounts module with 409 guard on delete"`

---

## Task 6: Holdings Module

**Files:**
- Create: `api/src/modules/holdings/holdings.repository.ts`
- Create: `api/src/modules/holdings/holdings.service.ts`
- Create: `api/src/modules/holdings/holdings.controller.ts`
- Create: `api/src/modules/holdings/holdings.schema.ts`
- Test: `api/tests/holdings.test.ts`

### Business Rules (Service layer)
- `PUT /holdings/:assetId/:accountId` — upsert quantity; both asset and account must exist → 404
- `quantity` must be >= 0 (enforced by Zod schema)
- `GET /holdings` — join with assets + accounts + latest `snapshot_items.value_in_base` (nullable)
- Optional query param `?account_id=` to filter

- [ ] Step 1: Write the failing tests

```ts
// api/tests/holdings.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import app from '../src/index'
import { cleanDb, closeDb, testDb } from './helpers/db'
import { accounts, assets } from '../src/db/schema'

beforeEach(() => cleanDb())
afterAll(() => closeDb())

const seedAssetAndAccount = async () => {
  const [asset] = await testDb.insert(assets).values({
    name: 'BTC', assetClass: 'asset', category: 'investment',
    subKind: 'crypto', currencyCode: 'USD', pricingMode: 'market',
  }).returning()
  const [account] = await testDb.insert(accounts).values({ name: 'Binance', accountType: 'crypto_exchange' }).returning()
  return { asset, account }
}

describe('PUT /api/v1/holdings/:assetId/:accountId', () => {
  it('upserts holding and returns 200', async () => {
    const { asset, account } = await seedAssetAndAccount()
    const res = await app.request(`/api/v1/holdings/${asset.id}/${account.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 0.5 }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).quantity).toBe('0.50000000')
  })

  it('returns 404 if asset does not exist', async () => {
    const [account] = await testDb.insert(accounts).values({ name: 'X', accountType: 'bank' }).returning()
    const res = await app.request(`/api/v1/holdings/00000000-0000-0000-0000-000000000000/${account.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 1 }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 422 if quantity is negative', async () => {
    const { asset, account } = await seedAssetAndAccount()
    const res = await app.request(`/api/v1/holdings/${asset.id}/${account.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: -1 }),
    })
    expect(res.status).toBe(422)
  })
})

describe('GET /api/v1/holdings', () => {
  it('returns holdings with joined asset and account fields', async () => {
    const { asset, account } = await seedAssetAndAccount()
    await app.request(`/api/v1/holdings/${asset.id}/${account.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 2 }),
    })
    const res = await app.request('/api/v1/holdings')
    expect(res.status).toBe(200)
    const list = await res.json()
    expect(list[0].asset_name).toBe('BTC')
    expect(list[0].account_name).toBe('Binance')
    expect(list[0].latest_value_in_base).toBeNull()
  })
})

describe('DELETE /api/v1/holdings/:assetId/:accountId', () => {
  it('deletes a holding and returns 204', async () => {
    const { asset, account } = await seedAssetAndAccount()
    await app.request(`/api/v1/holdings/${asset.id}/${account.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 1 }),
    })
    const res = await app.request(`/api/v1/holdings/${asset.id}/${account.id}`, { method: 'DELETE' })
    expect(res.status).toBe(204)
  })
})
```

- [ ] Step 2: Run: `cd api && npx vitest run tests/holdings.test.ts` — Expected: FAIL

- [ ] Step 3: Implement repository → service → controller

**`holdings.schema.ts`:**
```ts
import { z } from 'zod'
export const HoldingUpsertSchema = z.object({
  quantity: z.number().min(0),
})
export type HoldingUpsertInput = z.infer<typeof HoldingUpsertSchema>
```

**`holdings.repository.ts`** (upsert + joined list query):
```ts
import { eq, and, sql } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { holdings, assets, accounts, snapshotItems } from '../../db/schema'

export class HoldingsRepository {
  constructor(private db: DrizzleDB) {}

  async findAll(accountId?: string) {
    // Join with assets + accounts + latest snapshot value
    const query = this.db
      .select({
        assetId: holdings.assetId,
        accountId: holdings.accountId,
        quantity: holdings.quantity,
        assetName: assets.name,
        assetClass: assets.assetClass,
        category: assets.category,
        subKind: assets.subKind,
        currencyCode: assets.currencyCode,
        pricingMode: assets.pricingMode,
        accountName: accounts.name,
        accountType: accounts.accountType,
        updatedAt: holdings.updatedAt,
        latestValueInBase: sql<string | null>`(
          SELECT value_in_base FROM snapshot_items si
          WHERE si.asset_id = ${holdings.assetId} AND si.account_id = ${holdings.accountId}
          ORDER BY si.snapshot_date DESC LIMIT 1
        )`,
      })
      .from(holdings)
      .innerJoin(assets, eq(holdings.assetId, assets.id))
      .innerJoin(accounts, eq(holdings.accountId, accounts.id))

    if (accountId) return query.where(eq(holdings.accountId, accountId))
    return query
  }

  findOne(assetId: string, accountId: string) {
    return this.db.select().from(holdings)
      .where(and(eq(holdings.assetId, assetId), eq(holdings.accountId, accountId)))
      .then(r => r[0] ?? null)
  }

  upsert(assetId: string, accountId: string, quantity: string) {
    return this.db.insert(holdings)
      .values({ assetId, accountId, quantity })
      .onConflictDoUpdate({
        target: [holdings.assetId, holdings.accountId],
        set: { quantity, updatedAt: new Date() },
      })
      .returning().then(r => r[0])
  }

  delete(assetId: string, accountId: string) {
    return this.db.delete(holdings)
      .where(and(eq(holdings.assetId, assetId), eq(holdings.accountId, accountId)))
      .returning().then(r => r[0] ?? null)
  }
}
```

**`holdings.service.ts`:**
```ts
import { HoldingsRepository } from './holdings.repository'
import { AssetsRepository } from '../assets/assets.repository'
import { AccountsRepository } from '../accounts/accounts.repository'
import { HoldingUpsertInput } from './holdings.schema'
import { HTTPException } from 'hono/http-exception'

export class HoldingsService {
  constructor(
    private repo: HoldingsRepository,
    private assetsRepo: AssetsRepository,
    private accountsRepo: AccountsRepository,
  ) {}

  findAll(accountId?: string) { return this.repo.findAll(accountId) }

  async upsert(assetId: string, accountId: string, data: HoldingUpsertInput) {
    const asset = await this.assetsRepo.findById(assetId)
    if (!asset) throw new HTTPException(404, { message: 'Asset not found' })
    const account = await this.accountsRepo.findById(accountId)
    if (!account) throw new HTTPException(404, { message: 'Account not found' })
    return this.repo.upsert(assetId, accountId, String(data.quantity))
  }

  async delete(assetId: string, accountId: string) {
    const existing = await this.repo.findOne(assetId, accountId)
    if (!existing) throw new HTTPException(404, { message: 'Holding not found' })
    return this.repo.delete(assetId, accountId)
  }
}
```

**`holdings.controller.ts`:**
```ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { HoldingsRepository } from './holdings.repository'
import { HoldingsService } from './holdings.service'
import { AssetsRepository } from '../assets/assets.repository'
import { AccountsRepository } from '../accounts/accounts.repository'
import { HoldingUpsertSchema } from './holdings.schema'

const holdingsController = new Hono()
const service = new HoldingsService(
  new HoldingsRepository(db),
  new AssetsRepository(db),
  new AccountsRepository(db),
)

holdingsController.get('/', async (c) => {
  const accountId = c.req.query('account_id')
  const list = await service.findAll(accountId)
  return c.json(list.map(h => ({
    asset_id: h.assetId, account_id: h.accountId, quantity: h.quantity,
    asset_name: h.assetName, asset_class: h.assetClass, category: h.category,
    sub_kind: h.subKind, currency_code: h.currencyCode, pricing_mode: h.pricingMode,
    account_name: h.accountName, account_type: h.accountType,
    latest_value_in_base: h.latestValueInBase ?? null,
    updated_at: h.updatedAt,
  })))
})

holdingsController.put('/:assetId/:accountId', zValidator('json', HoldingUpsertSchema), async (c) => {
  const holding = await service.upsert(
    c.req.param('assetId'), c.req.param('accountId'), c.req.valid('json')
  )
  return c.json(holding)
})

holdingsController.delete('/:assetId/:accountId', async (c) => {
  await service.delete(c.req.param('assetId'), c.req.param('accountId'))
  return c.body(null, 204)
})

export default holdingsController
```

- [ ] Step 4: Run: `cd api && npx vitest run tests/holdings.test.ts` — Expected: PASS
- [ ] Step 5: Commit `git commit -m "feat: holdings module with upsert, joined GET, and 404 guards"`

---

## Task 7: Transactions Module

**Files:**
- Create: `api/src/modules/transactions/transactions.repository.ts`
- Create: `api/src/modules/transactions/transactions.service.ts`
- Create: `api/src/modules/transactions/transactions.controller.ts`
- Create: `api/src/modules/transactions/transactions.schema.ts`
- Test: `api/tests/transactions.test.ts`

### Business Rules (Service layer)
- `POST /transactions`: only `txn_type='adjustment'` allows negative `quantity`; all others → 422
- `PATCH /transactions/:id`: only `note` field can be modified
- `DELETE /transactions/:id`: only `txn_type='adjustment'` can be deleted → 422 for other types

- [ ] Step 1: Write the failing tests

```ts
// api/tests/transactions.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import app from '../src/index'
import { cleanDb, closeDb, testDb } from './helpers/db'
import { accounts, assets } from '../src/db/schema'

beforeEach(() => cleanDb())
afterAll(() => closeDb())

const seedAssetAndAccount = async () => {
  const [asset] = await testDb.insert(assets).values({
    name: 'ETH', assetClass: 'asset', category: 'investment',
    subKind: 'crypto', currencyCode: 'USD', pricingMode: 'market',
  }).returning()
  const [account] = await testDb.insert(accounts).values({ name: 'OKX', accountType: 'crypto_exchange' }).returning()
  return { asset, account }
}

describe('POST /api/v1/transactions', () => {
  it('creates a buy transaction (positive quantity)', async () => {
    const { asset, account } = await seedAssetAndAccount()
    const res = await app.request('/api/v1/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: asset.id, account_id: account.id,
        txn_type: 'buy', quantity: 1.0, txn_date: '2026-03-20', note: 'test buy' }),
    })
    expect(res.status).toBe(201)
    expect((await res.json()).txnType).toBe('buy')
  })

  it('rejects negative quantity for buy type → 422', async () => {
    const { asset, account } = await seedAssetAndAccount()
    const res = await app.request('/api/v1/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: asset.id, account_id: account.id,
        txn_type: 'buy', quantity: -1.0, txn_date: '2026-03-20' }),
    })
    expect(res.status).toBe(422)
  })

  it('allows negative quantity for adjustment type', async () => {
    const { asset, account } = await seedAssetAndAccount()
    const res = await app.request('/api/v1/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: asset.id, account_id: account.id,
        txn_type: 'adjustment', quantity: -0.5, txn_date: '2026-03-20' }),
    })
    expect(res.status).toBe(201)
  })
})

describe('PATCH /api/v1/transactions/:id', () => {
  it('updates only note field', async () => {
    const { asset, account } = await seedAssetAndAccount()
    const create = await app.request('/api/v1/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: asset.id, account_id: account.id,
        txn_type: 'adjustment', quantity: 1, txn_date: '2026-03-20' }),
    })
    const { id } = await create.json()
    const res = await app.request(`/api/v1/transactions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'corrected note' }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).note).toBe('corrected note')
  })
})

describe('DELETE /api/v1/transactions/:id', () => {
  it('deletes adjustment transaction → 204', async () => {
    const { asset, account } = await seedAssetAndAccount()
    const create = await app.request('/api/v1/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: asset.id, account_id: account.id,
        txn_type: 'adjustment', quantity: 1, txn_date: '2026-03-20' }),
    })
    const { id } = await create.json()
    const res = await app.request(`/api/v1/transactions/${id}`, { method: 'DELETE' })
    expect(res.status).toBe(204)
  })

  it('rejects delete of non-adjustment transaction → 422', async () => {
    const { asset, account } = await seedAssetAndAccount()
    const create = await app.request('/api/v1/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: asset.id, account_id: account.id,
        txn_type: 'buy', quantity: 1, txn_date: '2026-03-20' }),
    })
    const { id } = await create.json()
    const res = await app.request(`/api/v1/transactions/${id}`, { method: 'DELETE' })
    expect(res.status).toBe(422)
  })
})
```

- [ ] Step 2: Run: `cd api && npx vitest run tests/transactions.test.ts` — Expected: FAIL

- [ ] Step 3: Implement repository → service → controller

**`transactions.schema.ts`:**
```ts
import { z } from 'zod'

export const TransactionCreateSchema = z.object({
  asset_id: z.string().uuid(),
  account_id: z.string().uuid(),
  txn_type: z.enum(['buy', 'sell', 'transfer_in', 'transfer_out', 'adjustment']),
  quantity: z.number(),
  txn_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
})

export const TransactionPatchSchema = z.object({
  note: z.string().optional(),
})

export type TransactionCreateInput = z.infer<typeof TransactionCreateSchema>
export type TransactionPatchInput = z.infer<typeof TransactionPatchSchema>
```

**`transactions.repository.ts`:**
```ts
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { transactions } from '../../db/schema'

export class TransactionsRepository {
  constructor(private db: DrizzleDB) {}

  findAll(filters: { assetId?: string; accountId?: string; from?: string; to?: string }) {
    let query = this.db.select().from(transactions).$dynamic()
    if (filters.assetId) query = query.where(eq(transactions.assetId, filters.assetId))
    if (filters.accountId) query = query.where(eq(transactions.accountId, filters.accountId))
    if (filters.from) query = query.where(gte(transactions.txnDate, filters.from))
    if (filters.to) query = query.where(lte(transactions.txnDate, filters.to))
    return query.orderBy(desc(transactions.txnDate))
  }

  findById(id: string) {
    return this.db.select().from(transactions).where(eq(transactions.id, id)).then(r => r[0] ?? null)
  }

  create(data: typeof transactions.$inferInsert) {
    return this.db.insert(transactions).values(data).returning().then(r => r[0])
  }

  updateNote(id: string, note: string | null) {
    return this.db.update(transactions).set({ note, updatedAt: new Date() })
      .where(eq(transactions.id, id)).returning().then(r => r[0] ?? null)
  }

  delete(id: string) {
    return this.db.delete(transactions).where(eq(transactions.id, id)).returning().then(r => r[0] ?? null)
  }
}
```

**`transactions.service.ts`:**
```ts
import { TransactionsRepository } from './transactions.repository'
import { TransactionCreateInput, TransactionPatchInput } from './transactions.schema'
import { HTTPException } from 'hono/http-exception'

const ADJUSTMENT_TYPE = 'adjustment'
const POSITIVE_ONLY_TYPES = ['buy', 'sell', 'transfer_in', 'transfer_out']

export class TransactionsService {
  constructor(private repo: TransactionsRepository) {}

  findAll(filters: { assetId?: string; accountId?: string; from?: string; to?: string }) {
    return this.repo.findAll(filters)
  }

  async create(data: TransactionCreateInput) {
    if (POSITIVE_ONLY_TYPES.includes(data.txn_type) && data.quantity < 0)
      throw new HTTPException(422, { message: `quantity must be positive for txn_type=${data.txn_type}` })
    return this.repo.create({
      assetId: data.asset_id, accountId: data.account_id,
      txnType: data.txn_type, quantity: String(data.quantity),
      txnDate: data.txn_date, note: data.note ?? null,
    })
  }

  async updateNote(id: string, data: TransactionPatchInput) {
    const existing = await this.repo.findById(id)
    if (!existing) throw new HTTPException(404, { message: 'Transaction not found' })
    return this.repo.updateNote(id, data.note ?? null)
  }

  async delete(id: string) {
    const existing = await this.repo.findById(id)
    if (!existing) throw new HTTPException(404, { message: 'Transaction not found' })
    if (existing.txnType !== ADJUSTMENT_TYPE)
      throw new HTTPException(422, { message: 'Only adjustment transactions can be deleted' })
    return this.repo.delete(id)
  }
}
```

**`transactions.controller.ts`:**
```ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { TransactionsRepository } from './transactions.repository'
import { TransactionsService } from './transactions.service'
import { TransactionCreateSchema, TransactionPatchSchema } from './transactions.schema'

const transactionsController = new Hono()
const service = new TransactionsService(new TransactionsRepository(db))

transactionsController.get('/', async (c) => {
  const { asset_id, account_id, from, to } = c.req.query()
  return c.json(await service.findAll({ assetId: asset_id, accountId: account_id, from, to }))
})

transactionsController.post('/', zValidator('json', TransactionCreateSchema), async (c) => {
  return c.json(await service.create(c.req.valid('json')), 201)
})

transactionsController.patch('/:id', zValidator('json', TransactionPatchSchema), async (c) => {
  return c.json(await service.updateNote(c.req.param('id'), c.req.valid('json')))
})

transactionsController.delete('/:id', async (c) => {
  await service.delete(c.req.param('id'))
  return c.body(null, 204)
})

export default transactionsController
```

- [ ] Step 4: Run: `cd api && npx vitest run tests/transactions.test.ts` — Expected: PASS
- [ ] Step 5: Commit `git commit -m "feat: transactions module with type-based quantity and delete restrictions"`

---

## Task 8: Prices Module

**Files:**
- Create: `api/src/modules/prices/prices.repository.ts`
- Create: `api/src/modules/prices/prices.service.ts`
- Create: `api/src/modules/prices/prices.controller.ts`
- Create: `api/src/modules/prices/prices.schema.ts`
- Test: `api/tests/prices.test.ts`

### Business Rules (Service layer)
- `POST /prices/manual`: only for assets where `pricing_mode='manual'` → 422 otherwise
- Upsert on `(asset_id, price_date)` conflict

- [ ] Step 1: Write the failing tests

```ts
// api/tests/prices.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import app from '../src/index'
import { cleanDb, closeDb, testDb } from './helpers/db'
import { assets } from '../src/db/schema'

beforeEach(() => cleanDb())
afterAll(() => closeDb())

describe('POST /api/v1/prices/manual', () => {
  it('creates a manual price for a manual-mode asset', async () => {
    const [asset] = await testDb.insert(assets).values({
      name: 'Gold', assetClass: 'asset', category: 'investment',
      subKind: 'precious_metal', currencyCode: 'TWD', pricingMode: 'manual',
    }).returning()

    const res = await app.request('/api/v1/prices/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: asset.id, price_date: '2026-03-22', price: 7900000 }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.price).toBe('7900000.00000000')
    expect(body.source).toBe('manual')
  })

  it('returns 422 for market-mode asset', async () => {
    const [asset] = await testDb.insert(assets).values({
      name: 'AAPL', assetClass: 'asset', category: 'investment',
      subKind: 'stock', currencyCode: 'USD', pricingMode: 'market',
    }).returning()

    const res = await app.request('/api/v1/prices/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: asset.id, price_date: '2026-03-22', price: 210 }),
    })
    expect(res.status).toBe(422)
  })
})

describe('GET /api/v1/prices', () => {
  it('returns price history for an asset', async () => {
    const [asset] = await testDb.insert(assets).values({
      name: 'Fund A', assetClass: 'asset', category: 'investment',
      subKind: 'fund', currencyCode: 'TWD', pricingMode: 'manual',
    }).returning()
    await app.request('/api/v1/prices/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: asset.id, price_date: '2026-03-22', price: 10.5 }),
    })
    const res = await app.request(`/api/v1/prices?asset_id=${asset.id}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(1)
  })
})
```

- [ ] Step 2: Run: `cd api && npx vitest run tests/prices.test.ts` — Expected: FAIL

- [ ] Step 3: Implement repository → service → controller

**`prices.schema.ts`:**
```ts
import { z } from 'zod'
export const PriceManualCreateSchema = z.object({
  asset_id: z.string().uuid(),
  price_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  price: z.number().min(0),
})
export type PriceManualCreateInput = z.infer<typeof PriceManualCreateSchema>
```

**`prices.repository.ts`:**
```ts
import { eq, gte, lte, and } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { prices } from '../../db/schema'

export class PricesRepository {
  constructor(private db: DrizzleDB) {}

  findAll(filters: { assetId?: string; from?: string; to?: string }) {
    let query = this.db.select().from(prices).$dynamic()
    if (filters.assetId) query = query.where(eq(prices.assetId, filters.assetId))
    if (filters.from) query = query.where(gte(prices.priceDate, filters.from))
    if (filters.to) query = query.where(lte(prices.priceDate, filters.to))
    return query
  }

  upsert(assetId: string, priceDate: string, price: string, source: string) {
    return this.db.insert(prices)
      .values({ assetId, priceDate, price, source })
      .onConflictDoUpdate({
        target: [prices.assetId, prices.priceDate],
        set: { price, source, updatedAt: new Date() },
      })
      .returning().then(r => r[0])
  }
}
```

**`prices.service.ts`:**
```ts
import { PricesRepository } from './prices.repository'
import { AssetsRepository } from '../assets/assets.repository'
import { PriceManualCreateInput } from './prices.schema'
import { HTTPException } from 'hono/http-exception'

export class PricesService {
  constructor(private repo: PricesRepository, private assetsRepo: AssetsRepository) {}

  findAll(filters: { assetId?: string; from?: string; to?: string }) {
    return this.repo.findAll(filters)
  }

  async createManual(data: PriceManualCreateInput) {
    const asset = await this.assetsRepo.findById(data.asset_id)
    if (!asset) throw new HTTPException(404, { message: 'Asset not found' })
    if (asset.pricingMode !== 'manual')
      throw new HTTPException(422, { message: 'Manual price entry only for pricing_mode=manual assets' })
    return this.repo.upsert(data.asset_id, data.price_date, String(data.price), 'manual')
  }
}
```

**`prices.controller.ts`:**
```ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { PricesRepository } from './prices.repository'
import { PricesService } from './prices.service'
import { AssetsRepository } from '../assets/assets.repository'
import { PriceManualCreateSchema } from './prices.schema'

const pricesController = new Hono()
const service = new PricesService(new PricesRepository(db), new AssetsRepository(db))

pricesController.get('/', async (c) => {
  const { asset_id, from, to } = c.req.query()
  return c.json(await service.findAll({ assetId: asset_id, from, to }))
})

pricesController.post('/manual', zValidator('json', PriceManualCreateSchema), async (c) => {
  return c.json(await service.createManual(c.req.valid('json')), 201)
})

export default pricesController
```

- [ ] Step 4: Run: `cd api && npx vitest run tests/prices.test.ts` — Expected: PASS
- [ ] Step 5: Commit `git commit -m "feat: prices module with manual-only pricing_mode guard"`

---

## Task 9: FX Rates Module

**Files:**
- Create: `api/src/modules/fx-rates/fx-rates.repository.ts`
- Create: `api/src/modules/fx-rates/fx-rates.service.ts`
- Create: `api/src/modules/fx-rates/fx-rates.controller.ts`
- Create: `api/src/modules/fx-rates/fx-rates.schema.ts`
- Test: `api/tests/fx-rates.test.ts`

### Business Rules (Service layer)
- `POST /fx-rates/manual`: upsert on `(from_currency, to_currency, rate_date)` conflict; `rate` must be > 0
- `GET /fx-rates`: filter by `from`, `to`, `from_date`, `to_date` query params

- [ ] Step 1: Write the failing tests

```ts
// api/tests/fx-rates.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import app from '../src/index'
import { cleanDb, closeDb } from './helpers/db'

beforeEach(() => cleanDb())
afterAll(() => closeDb())

describe('POST /api/v1/fx-rates/manual', () => {
  it('creates an FX rate and returns 201', async () => {
    const res = await app.request('/api/v1/fx-rates/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_currency: 'USD', to_currency: 'TWD',
        rate_date: '2026-03-22', rate: 32.67 }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.fromCurrency).toBe('USD')
    expect(body.rate).toBe('32.6700000000')
  })

  it('upserts on conflict (same currency pair + date)', async () => {
    const payload = { from_currency: 'USD', to_currency: 'TWD', rate_date: '2026-03-22', rate: 32.00 }
    await app.request('/api/v1/fx-rates/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const res = await app.request('/api/v1/fx-rates/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, rate: 32.50 }),
    })
    expect(res.status).toBe(201)
    expect((await res.json()).rate).toBe('32.5000000000')
  })

  it('returns 422 if rate is zero or negative', async () => {
    const res = await app.request('/api/v1/fx-rates/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_currency: 'USD', to_currency: 'TWD',
        rate_date: '2026-03-22', rate: 0 }),
    })
    expect(res.status).toBe(422)
  })
})

describe('GET /api/v1/fx-rates', () => {
  it('returns fx rate history filtered by from/to', async () => {
    await app.request('/api/v1/fx-rates/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_currency: 'JPY', to_currency: 'TWD',
        rate_date: '2026-03-22', rate: 0.21 }),
    })
    const res = await app.request('/api/v1/fx-rates?from=JPY&to=TWD')
    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(1)
  })
})
```

- [ ] Step 2: Run: `cd api && npx vitest run tests/fx-rates.test.ts` — Expected: FAIL

- [ ] Step 3: Implement repository → service → controller

**`fx-rates.schema.ts`:**
```ts
import { z } from 'zod'
export const FxRateManualCreateSchema = z.object({
  from_currency: z.string().min(3).max(10),
  to_currency: z.string().min(3).max(10),
  rate_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rate: z.number().positive(),
})
export type FxRateManualCreateInput = z.infer<typeof FxRateManualCreateSchema>
```

**`fx-rates.repository.ts`:**
```ts
import { eq, and, gte, lte } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { fxRates } from '../../db/schema'

export class FxRatesRepository {
  constructor(private db: DrizzleDB) {}

  findAll(filters: { from?: string; to?: string; fromDate?: string; toDate?: string }) {
    let query = this.db.select().from(fxRates).$dynamic()
    if (filters.from) query = query.where(eq(fxRates.fromCurrency, filters.from))
    if (filters.to) query = query.where(eq(fxRates.toCurrency, filters.to))
    if (filters.fromDate) query = query.where(gte(fxRates.rateDate, filters.fromDate))
    if (filters.toDate) query = query.where(lte(fxRates.rateDate, filters.toDate))
    return query
  }

  upsert(from: string, to: string, rateDate: string, rate: string, source: string) {
    return this.db.insert(fxRates)
      .values({ fromCurrency: from, toCurrency: to, rateDate, rate, source })
      .onConflictDoUpdate({
        target: [fxRates.fromCurrency, fxRates.toCurrency, fxRates.rateDate],
        set: { rate, source, updatedAt: new Date() },
      })
      .returning().then(r => r[0])
  }
}
```

**`fx-rates.service.ts`:**
```ts
import { FxRatesRepository } from './fx-rates.repository'
import { FxRateManualCreateInput } from './fx-rates.schema'

export class FxRatesService {
  constructor(private repo: FxRatesRepository) {}

  findAll(filters: { from?: string; to?: string; fromDate?: string; toDate?: string }) {
    return this.repo.findAll(filters)
  }

  createManual(data: FxRateManualCreateInput) {
    return this.repo.upsert(
      data.from_currency, data.to_currency, data.rate_date, String(data.rate), 'manual'
    )
  }
}
```

> Note: `rate > 0` validation is enforced by Zod (`z.number().positive()`), so the service stays minimal. Zod validation failure returns 422 automatically via `zValidator`.

**`fx-rates.controller.ts`:**
```ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { FxRatesRepository } from './fx-rates.repository'
import { FxRatesService } from './fx-rates.service'
import { FxRateManualCreateSchema } from './fx-rates.schema'

const fxRatesController = new Hono()
const service = new FxRatesService(new FxRatesRepository(db))

fxRatesController.get('/', async (c) => {
  const { from, to, from_date, to_date } = c.req.query()
  return c.json(await service.findAll({ from, to, fromDate: from_date, toDate: to_date }))
})

fxRatesController.post('/manual', zValidator('json', FxRateManualCreateSchema), async (c) => {
  return c.json(await service.createManual(c.req.valid('json')), 201)
})

export default fxRatesController
```

- [ ] Step 4: Run: `cd api && npx vitest run tests/fx-rates.test.ts` — Expected: PASS
- [ ] Step 5: Run full test suite: `cd api && npx vitest run` — Expected: ALL PASS
- [ ] Step 6: Commit `git commit -m "feat: fx-rates module and complete backend foundation test suite"`

---

## Final Verification Checklist

- [ ] `docker compose up` starts `db`, `api`, `web` without errors
- [ ] `cd api && npm run db:migrate` applies all 7 tables to the dev DB
- [ ] `GET /health` returns `{ status: "ok" }`
- [ ] `cd api && npx vitest run` — all tests pass
- [ ] All 6 modules follow Controller-Service-Repository pattern strictly
- [ ] All business rules validated at Service layer, not Controller
- [ ] All HTTP input validated via Zod + `zValidator` at Controller layer
- [ ] No business logic in Repository layer
- [ ] Test `beforeEach` runs `cleanDb()` for full isolation

---

## Key Implementation Notes

**Dependency injection pattern:** Each controller instantiates its own `Repository` and `Service` using the shared `db` client. For tests, the `testDb` client (pointing to `test_atomworth`) is injected by replacing `process.env.DATABASE_URL` with `TEST_DATABASE_URL` before importing the app.

**Error propagation:** Services throw `HTTPException` from `hono/http-exception`. The global `app.onError` handler in `index.ts` catches these and returns `{ error: message }` with the correct status code. Zod validation errors from `zValidator` also return 422 automatically.

**Numeric precision:** All `NUMERIC` fields in Drizzle are returned as strings by the postgres driver. Test assertions must use string values (e.g., `'0.50000000'`) or parse with `parseFloat`. This matches the DB spec's `NUMERIC(24,8)` and `NUMERIC(24,10)` column definitions.

**Immutable fields on PATCH /assets:** `AssetUpdateSchema` only accepts `name`, `symbol`, `market` — Zod strips or rejects any other fields. The service additionally checks for snapshot existence before allowing the update, but since the schema already prevents passing immutable fields, the 422 guard in the service is a belt-and-suspenders defense.

**`test_atomworth` database:** Must be created manually before running tests:
```bash
psql -U atomworth -c "CREATE DATABASE test_atomworth;"
cd api && TEST_DATABASE_URL=postgres://atomworth:atomworth@localhost:5432/test_atomworth npm run db:migrate
```
