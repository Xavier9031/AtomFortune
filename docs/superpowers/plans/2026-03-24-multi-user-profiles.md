# Multi-User Profiles + Encrypted Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-user profile switching (each user owns their own assets/accounts/holdings/transactions/snapshots) and encrypted AES-256-GCM backup export/import, with a UserSwitcher component in the sidebar.

**Architecture:** A new `users` table is added to the SQLite schema. Six existing tables gain a `userId` FK column via a single migration that also backfills a default user (`id='default-user'`). Every API route reads `X-User-Id` from request headers and forwards it through the Controller → Service → Repository stack. The web stores `activeUserId` in `localStorage` and injects the header via an updated `fetcher` and all direct `fetch()` calls. Backup export/import gains optional AES-256-GCM encryption using Node.js `crypto.scryptSync` + `createCipheriv`.

**Tech Stack:** Drizzle ORM (SQLite), Hono, Vitest, Next.js, Node.js `crypto` (built-in), `fflate`, Zod, React, `next-intl`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `api/src/db/schema.ts` | Modify | Add `users` table; add `userId` FK to 6 tables |
| `api/drizzle/0001_multi_user.sql` | Create | Migration: create `users`, ADD COLUMN `userId` to 6 tables, backfill |
| `api/src/modules/users/users.repository.ts` | Create | CRUD for users table |
| `api/src/modules/users/users.controller.ts` | Create | GET/POST/PUT/DELETE /api/v1/users |
| `api/src/modules/users/users.schema.ts` | Create | Zod schemas for user create/update |
| `api/src/index.ts` | Modify | Register `usersController` route |
| `api/src/modules/assets/assets.repository.ts` | Modify | All queries filter by `userId` |
| `api/src/modules/assets/assets.service.ts` | Modify | Accept/pass `userId` |
| `api/src/modules/assets/assets.controller.ts` | Modify | Read header, pass `userId` |
| `api/src/modules/accounts/accounts.repository.ts` | Modify | All queries filter by `userId` |
| `api/src/modules/accounts/accounts.service.ts` | Modify | Accept/pass `userId` |
| `api/src/modules/accounts/accounts.controller.ts` | Modify | Read header, pass `userId` |
| `api/src/modules/holdings/holdings.repository.ts` | Modify | All queries filter by `userId` via asset join |
| `api/src/modules/holdings/holdings.service.ts` | Modify | Accept/pass `userId` |
| `api/src/modules/holdings/holdings.controller.ts` | Modify | Read header, pass `userId` |
| `api/src/modules/transactions/transactions.repository.ts` | Modify | Filter by `userId` |
| `api/src/modules/transactions/transactions.service.ts` | Modify | Accept/pass `userId` |
| `api/src/modules/transactions/transactions.controller.ts` | Modify | Read header, pass `userId` |
| `api/src/modules/snapshot-items/snapshot-items.repository.ts` | Modify | Filter by `userId` |
| `api/src/modules/recurring-entries/recurring-entries.repository.ts` | Modify | Filter by `userId` |
| `api/src/modules/recurring-entries/recurring-entries.controller.ts` | Modify | Read header, pass `userId` |
| `api/src/modules/dashboard/dashboard.repository.ts` | Modify | All queries accept `userId` param |
| `api/src/modules/dashboard/dashboard.service.ts` | Modify | Accept/pass `userId` |
| `api/src/modules/dashboard/dashboard.controller.ts` | Modify | Read header, pass `userId` |
| `api/src/modules/backup/backup.controller.ts` | Modify | Per-user scope; AES-256-GCM encrypt/decrypt |
| `api/src/jobs/snapshot.job.ts` | Modify | `getAllHoldingsWithAssets` accepts `userId`; `dailySnapshotJob` iterates all users |
| `api/tests/helpers/db.ts` | Modify | `cleanDb` deletes `users` table; add `seedTestUser()` helper |
| `api/tests/users.test.ts` | Create | Tests for users CRUD routes |
| `api/tests/assets.test.ts` | Modify | Add `X-User-Id` header; seed user before tests |
| `api/tests/accounts.test.ts` | Modify | Same pattern |
| `api/tests/holdings.test.ts` | Modify | Same pattern |
| `api/tests/transactions.test.ts` | Modify | Same pattern |
| `api/tests/backup.test.ts` | Modify | Per-user export/import; encryption tests |
| `web/lib/user.ts` | Create | `getActiveUserId()`, `setActiveUserId()`, `ensureActiveUserId()` localStorage helpers |
| `web/lib/api.ts` | Modify | `fetcher` reads localStorage and adds `X-User-Id` header |
| `web/app/settings/page.tsx` | Modify | `fetch()` calls add `X-User-Id` header; export modal adds password input |
| `web/app/snapshots/page.tsx` | Modify | `fetch()` calls add `X-User-Id` header |
| `web/components/snapshots/SnapshotsList.tsx` | Modify | `fetch()` calls add `X-User-Id` header |
| `web/components/holdings/HoldingSidePanel.tsx` | Modify | `fetch()` calls add `X-User-Id` header |
| `web/components/accounts/AccountSidePanel.tsx` | Modify | `fetch()` calls add `X-User-Id` header |
| `web/components/assets/AssetFormModal.tsx` | Modify | `fetch()` calls add `X-User-Id` header |
| `web/components/assets/RecurringEntriesPanel.tsx` | Modify | `fetch()` calls add `X-User-Id` header |
| `web/components/assets/ManualPriceModal.tsx` | Modify | `fetch()` calls add `X-User-Id` header |
| `web/components/assets/AssetSidePanel.tsx` | Modify | `fetch()` calls add `X-User-Id` header |
| `web/components/assets/AssetDetailView.tsx` | Modify | `fetch()` calls add `X-User-Id` header |
| `web/components/dashboard/NetWorthChart.tsx` | Modify | `fetch()` calls add `X-User-Id` header |
| `web/components/assets/TickerSearch.tsx` | Modify | `fetch()` calls add `X-User-Id` header |
| `web/components/layout/UserSwitcher.tsx` | Create | Avatar circle + name + dropdown + "New profile" |
| `web/components/layout/Sidebar.tsx` | Modify | Render `<UserSwitcher />` at bottom |
| `web/messages/en.json` | Modify | Add user switcher i18n keys |
| `web/messages/zh-TW.json` | Modify | Add user switcher i18n keys (zh-TW) |

---

## Task 1: Schema + Migration

**Files:**
- Modify: `api/src/db/schema.ts`
- Create: `api/drizzle/0001_multi_user.sql`

### Why this order

The migration must exist before any code changes because tests run `migrate()` at suite start. Writing the migration first ensures the schema and the SQL file stay in sync.

- [ ] **Step 1: Add `users` table and `userId` columns to `schema.ts`**

Open `api/src/db/schema.ts`. Add the `users` table at the top (before `assets`) and add a `userId` column to `assets`, `accounts`, `holdings`, `transactions`, `snapshotItems`, and `recurringEntries`. Do NOT add `userId` to `prices`, `fxRates`, or `tickers` — those are global market data.

```typescript
// At the top of api/src/db/schema.ts, before the `tickers` table:

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
})
```

Then add `userId` to `assets`:

```typescript
export const assets = sqliteTable('assets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  assetClass: text('assetClass').notNull(),
  category: text('category').notNull(),
  subKind: text('subKind').notNull(),
  symbol: text('symbol'),
  market: text('market'),
  currencyCode: text('currencyCode').notNull(),
  pricingMode: text('pricingMode').notNull(),
  unit: text('unit'),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
})
```

Add `userId` to `accounts`:

```typescript
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  institution: text('institution'),
  accountType: text('accountType').notNull(),
  note: text('note'),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
})
```

Add `userId` to `holdings` (note: composite PK is unchanged — `userId` is informational for filtering; the FK on `assets` already implies user ownership transitively, but we add it explicitly for efficient querying):

```typescript
export const holdings = sqliteTable('holdings', {
  assetId: text('assetId').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  accountId: text('accountId').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  quantity: numeric('quantity').notNull(),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({ pk: primaryKey({ columns: [t.assetId, t.accountId] }) }))
```

Add `userId` to `transactions`:

```typescript
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assetId: text('assetId').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  accountId: text('accountId').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  txnType: text('txnType').notNull(),
  quantity: numeric('quantity').notNull(),
  txnDate: text('txnDate').notNull(),
  note: text('note'),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
})
```

Add `userId` to `snapshotItems`:

```typescript
export const snapshotItems = sqliteTable('snapshotItems', {
  snapshotDate: text('snapshotDate').notNull(),
  assetId: text('assetId').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  accountId: text('accountId').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  quantity: numeric('quantity').notNull(),
  price: numeric('price').notNull(),
  fxRate: numeric('fxRate').notNull(),
  valueInBase: numeric('valueInBase').notNull(),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({ pk: primaryKey({ columns: [t.snapshotDate, t.assetId, t.accountId] }) }))
```

Add `userId` to `recurringEntries`:

```typescript
export const recurringEntries = sqliteTable('recurringEntries', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assetId: text('assetId').references(() => assets.id, { onDelete: 'cascade' }),
  accountId: text('accountId').references(() => accounts.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  amount: numeric('amount').notNull(),
  currencyCode: text('currencyCode').notNull().default('TWD'),
  dayOfMonth: integer('dayOfMonth').notNull().default(1),
  label: text('label'),
  effectiveFrom: text('effectiveFrom').notNull(),
  effectiveTo: text('effectiveTo'),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
})
```

- [ ] **Step 2: Create the migration file `api/drizzle/0001_multi_user.sql`**

SQLite does not support `ADD COLUMN ... NOT NULL` without a default when rows already exist. The migration uses a two-step approach: add as nullable, backfill, then rely on application code for the NOT NULL constraint (SQLite has limited ALTER TABLE). The migration inserts the default user first so the FK constraint is satisfied during backfill.

```sql
-- Create users table
CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint

-- Insert the default user (backfill target)
INSERT INTO `users` (`id`, `name`) VALUES ('default-user', 'Default');
--> statement-breakpoint

-- Add userId to assets (nullable so existing rows are accepted)
ALTER TABLE `assets` ADD COLUMN `userId` text REFERENCES `users`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
UPDATE `assets` SET `userId` = 'default-user' WHERE `userId` IS NULL;
--> statement-breakpoint

-- Add userId to accounts
ALTER TABLE `accounts` ADD COLUMN `userId` text REFERENCES `users`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
UPDATE `accounts` SET `userId` = 'default-user' WHERE `userId` IS NULL;
--> statement-breakpoint

-- Add userId to holdings
ALTER TABLE `holdings` ADD COLUMN `userId` text REFERENCES `users`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
UPDATE `holdings` SET `userId` = 'default-user' WHERE `userId` IS NULL;
--> statement-breakpoint

-- Add userId to transactions
ALTER TABLE `transactions` ADD COLUMN `userId` text REFERENCES `users`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
UPDATE `transactions` SET `userId` = 'default-user' WHERE `userId` IS NULL;
--> statement-breakpoint

-- Add userId to snapshotItems
ALTER TABLE `snapshotItems` ADD COLUMN `userId` text REFERENCES `users`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
UPDATE `snapshotItems` SET `userId` = 'default-user' WHERE `userId` IS NULL;
--> statement-breakpoint

-- Add userId to recurringEntries
ALTER TABLE `recurringEntries` ADD COLUMN `userId` text REFERENCES `users`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
UPDATE `recurringEntries` SET `userId` = 'default-user' WHERE `userId` IS NULL;
```

- [ ] **Step 3: Update Drizzle migration journal**

Open `api/drizzle/meta/_journal.json`. Add a new entry for migration `0001`. The journal file looks like this after the change (the `tag` is the filename without `.sql`):

```json
{
  "version": "7",
  "dialect": "sqlite",
  "entries": [
    {
      "idx": 0,
      "version": "6",
      "when": 1711000000000,
      "tag": "0000_mature_chronomancer",
      "breakpoints": true
    },
    {
      "idx": 1,
      "version": "6",
      "when": 1711200000000,
      "tag": "0001_multi_user",
      "breakpoints": true
    }
  ]
}
```

(Use the actual timestamp from the existing entry as a reference; increment by a reasonable amount.)

- [ ] **Step 4: Verify migration runs cleanly**

```bash
cd /Users/htchang/Desktop/AtomFortune/api
TEST_DATABASE_PATH=./test-migrate-verify.db node -e "
const { migrate } = require('drizzle-orm/better-sqlite3/migrator')
const { drizzle } = require('drizzle-orm/better-sqlite3')
const Database = require('better-sqlite3')
const path = require('path')
const sqlite = new Database('./test-migrate-verify.db')
const db = drizzle(sqlite)
migrate(db, { migrationsFolder: path.join(__dirname, 'drizzle') })
console.log('Migration OK')
sqlite.close()
require('fs').unlinkSync('./test-migrate-verify.db')
"
```

Expected output: `Migration OK`

- [ ] **Step 5: Commit**

```bash
cd /Users/htchang/Desktop/AtomFortune
git add api/src/db/schema.ts api/drizzle/0001_multi_user.sql api/drizzle/meta/_journal.json
git commit -m "feat(db): add users table and userId FK to 6 tables with backfill migration"
```

---

## Task 2: Users API Module (CRUD Routes + Tests)

**Files:**
- Create: `api/src/modules/users/users.repository.ts`
- Create: `api/src/modules/users/users.schema.ts`
- Create: `api/src/modules/users/users.controller.ts`
- Modify: `api/src/index.ts`
- Create: `api/tests/users.test.ts`

- [ ] **Step 1: Write the failing test first**

Create `api/tests/users.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import app from '../src/index'
import { cleanDb, closeDb, testDb, seedTestUser } from './helpers/db'
import { users } from '../src/db/schema'

beforeEach(() => cleanDb())
afterAll(() => closeDb())

describe('GET /api/v1/users', () => {
  it('returns empty array when no users', async () => {
    const res = await app.request('/api/v1/users')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns list of users after creation', async () => {
    await testDb.insert(users).values({ id: 'u1', name: 'Alice' })
    await testDb.insert(users).values({ id: 'u2', name: 'Bob' })
    const res = await app.request('/api/v1/users')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body.map((u: any) => u.name).sort()).toEqual(['Alice', 'Bob'])
  })
})

describe('POST /api/v1/users', () => {
  it('creates a user and returns 201', async () => {
    const res = await app.request('/api/v1/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Carol' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBeDefined()
    expect(body.name).toBe('Carol')
  })

  it('returns 400 if name is missing', async () => {
    const res = await app.request('/api/v1/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/v1/users/:id', () => {
  it('updates user name and returns 200', async () => {
    const [u] = await testDb.insert(users).values({ id: 'u1', name: 'Old' }).returning()
    const res = await app.request(`/api/v1/users/${u.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).name).toBe('New Name')
  })

  it('returns 404 for unknown user', async () => {
    const res = await app.request('/api/v1/users/nonexistent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/v1/users/:id', () => {
  it('deletes user and returns 204', async () => {
    const [u] = await testDb.insert(users).values({ id: 'u1', name: 'ToDelete' }).returning()
    const res = await app.request(`/api/v1/users/${u.id}`, { method: 'DELETE' })
    expect(res.status).toBe(204)
    const remaining = await testDb.select().from(users)
    expect(remaining).toHaveLength(0)
  })

  it('returns 404 for unknown user', async () => {
    const res = await app.request('/api/v1/users/ghost', { method: 'DELETE' })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests — expect failures (routes don't exist yet)**

```bash
cd /Users/htchang/Desktop/AtomFortune/api && npm test -- --reporter=verbose tests/users.test.ts
```

Expected: multiple FAIL with "404 Not Found" or import errors.

- [ ] **Step 3: Create `users.schema.ts`**

```typescript
// api/src/modules/users/users.schema.ts
import { z } from 'zod'

export const UserCreateSchema = z.object({
  name: z.string().min(1).max(100),
})

export const UserUpdateSchema = z.object({
  name: z.string().min(1).max(100),
})

export type UserCreateInput = z.infer<typeof UserCreateSchema>
export type UserUpdateInput = z.infer<typeof UserUpdateSchema>
```

- [ ] **Step 4: Create `users.repository.ts`**

```typescript
// api/src/modules/users/users.repository.ts
import { eq } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { users } from '../../db/schema'

export class UsersRepository {
  constructor(private db: DrizzleDB) {}

  findAll() {
    return this.db.select().from(users)
  }

  findById(id: string) {
    return this.db.select().from(users).where(eq(users.id, id)).then(r => r[0] ?? null)
  }

  create(data: { name: string }) {
    return this.db.insert(users).values({ name: data.name }).returning().then(r => r[0])
  }

  update(id: string, data: { name: string }) {
    return this.db.update(users)
      .set({ name: data.name, updatedAt: new Date().toISOString() })
      .where(eq(users.id, id))
      .returning()
      .then(r => r[0] ?? null)
  }

  delete(id: string) {
    return this.db.delete(users).where(eq(users.id, id)).returning().then(r => r[0] ?? null)
  }
}
```

- [ ] **Step 5: Create `users.controller.ts`**

```typescript
// api/src/modules/users/users.controller.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { UsersRepository } from './users.repository'
import { UserCreateSchema, UserUpdateSchema } from './users.schema'

const usersController = new Hono()
const repo = new UsersRepository(db)

usersController.get('/', async (c) => c.json(await repo.findAll()))

usersController.post('/', zValidator('json', UserCreateSchema, (result, c) => {
  if (!result.success) return c.json({ error: result.error.issues }, 400)
}), async (c) => {
  return c.json(await repo.create(c.req.valid('json')), 201)
})

usersController.put('/:id', zValidator('json', UserUpdateSchema, (result, c) => {
  if (!result.success) return c.json({ error: result.error.issues }, 400)
}), async (c) => {
  const user = await repo.update(c.req.param('id'), c.req.valid('json'))
  if (!user) return c.json({ error: 'Not found' }, 404)
  return c.json(user)
})

usersController.delete('/:id', async (c) => {
  const user = await repo.delete(c.req.param('id'))
  if (!user) return c.json({ error: 'Not found' }, 404)
  return c.body(null, 204)
})

export default usersController
```

- [ ] **Step 6: Register the route in `api/src/index.ts`**

Add these two lines (import + route registration) in the same location pattern as the other controllers:

```typescript
// After the existing imports near the top:
import usersController from './modules/users/users.controller'

// After app.route('/api/v1/recurring-entries', ...):
app.route('/api/v1/users', usersController)
```

- [ ] **Step 7: Run tests — expect passing**

```bash
cd /Users/htchang/Desktop/AtomFortune/api && npm test -- --reporter=verbose tests/users.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 8: Commit**

```bash
cd /Users/htchang/Desktop/AtomFortune
git add api/src/modules/users/ api/src/index.ts api/tests/users.test.ts
git commit -m "feat(api): add users CRUD module with tests"
```

---

## Task 3: Update Repositories + Controllers to Accept/Pass userId

**Files:**
- Modify: `api/src/modules/assets/assets.repository.ts`
- Modify: `api/src/modules/assets/assets.service.ts`
- Modify: `api/src/modules/assets/assets.controller.ts`
- Modify: `api/src/modules/accounts/accounts.repository.ts`
- Modify: `api/src/modules/accounts/accounts.service.ts`
- Modify: `api/src/modules/accounts/accounts.controller.ts`
- Modify: `api/src/modules/holdings/holdings.repository.ts`
- Modify: `api/src/modules/holdings/holdings.service.ts`
- Modify: `api/src/modules/holdings/holdings.controller.ts`
- Modify: `api/src/modules/transactions/transactions.repository.ts`
- Modify: `api/src/modules/transactions/transactions.service.ts`
- Modify: `api/src/modules/transactions/transactions.controller.ts`
- Modify: `api/src/modules/snapshot-items/snapshot-items.repository.ts`
- Modify: `api/src/modules/recurring-entries/recurring-entries.repository.ts`
- Modify: `api/src/modules/recurring-entries/recurring-entries.controller.ts`
- Modify: `api/src/modules/dashboard/dashboard.repository.ts`
- Modify: `api/src/modules/dashboard/dashboard.service.ts`
- Modify: `api/src/modules/dashboard/dashboard.controller.ts`

### The Pattern (shown in full for Assets; all other modules follow identically)

**Step-by-step rule:** (1) Repository method signatures gain `userId: string` first arg. (2) Every `where` clause adds `eq(table.userId, userId)`. (3) Every `insert` includes `userId`. (4) Service methods gain `userId: string` first arg and forward it to the repo. (5) Controller reads `const userId = c.req.header('x-user-id')` and returns 400 if missing; passes `userId` to service.

- [ ] **Step 1: Write failing test for the header guard (assets as example)**

In `api/tests/assets.test.ts`, add this test to the existing `POST /api/v1/assets` describe block:

```typescript
it('returns 400 if X-User-Id header is missing', async () => {
  const res = await app.request('/api/v1/assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'AAPL', assetClass: 'asset', category: 'investment',
      subKind: 'stock', currencyCode: 'USD', pricingMode: 'market',
    }),
    // No X-User-Id header
  })
  expect(res.status).toBe(400)
  expect((await res.json()).error).toBe('Missing X-User-Id header')
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/htchang/Desktop/AtomFortune/api && npm test -- --reporter=verbose tests/assets.test.ts
```

Expected: the new test FAILS (currently returns 201, not 400).

- [ ] **Step 3: Implement `getUserId` middleware helper**

Create a small inline helper used by each controller. Add this to `api/src/modules/assets/assets.controller.ts` (and repeat in each controller):

```typescript
function requireUserId(c: any): string | Response {
  const uid = c.req.header('x-user-id')
  if (!uid) return c.json({ error: 'Missing X-User-Id header' }, 400)
  return uid
}
```

- [ ] **Step 4: Update `assets.repository.ts` — complete rewrite**

```typescript
// api/src/modules/assets/assets.repository.ts
import { eq, and } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { assets, holdings } from '../../db/schema'

export class AssetsRepository {
  constructor(private db: DrizzleDB) {}

  findAll(userId: string) {
    return this.db.select().from(assets).where(eq(assets.userId, userId))
  }

  findById(id: string, userId: string) {
    return this.db.select().from(assets)
      .where(and(eq(assets.id, id), eq(assets.userId, userId)))
      .then(r => r[0] ?? null)
  }

  create(data: typeof assets.$inferInsert) {
    return this.db.insert(assets).values(data).returning().then(r => r[0])
  }

  update(id: string, userId: string, data: Partial<typeof assets.$inferInsert>) {
    return this.db.update(assets)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(and(eq(assets.id, id), eq(assets.userId, userId)))
      .returning().then(r => r[0] ?? null)
  }

  delete(id: string, userId: string) {
    return this.db.delete(assets)
      .where(and(eq(assets.id, id), eq(assets.userId, userId)))
      .returning().then(r => r[0] ?? null)
  }

  findBySubKindAndCurrency(userId: string, subKind: string, currencyCode: string) {
    return this.db.select().from(assets)
      .where(and(
        eq(assets.userId, userId),
        eq(assets.subKind, subKind),
        eq(assets.currencyCode, currencyCode),
      ))
      .limit(1)
      .then(r => r[0] ?? null)
  }

  findByAccountAndSubKind(userId: string, accountId: string, subKind: string, currencyCode?: string) {
    return this.db.select({
      id: assets.id, name: assets.name, assetClass: assets.assetClass,
      category: assets.category, subKind: assets.subKind, symbol: assets.symbol,
      market: assets.market, currencyCode: assets.currencyCode, pricingMode: assets.pricingMode,
      unit: assets.unit,
      createdAt: assets.createdAt, updatedAt: assets.updatedAt,
    })
      .from(assets)
      .innerJoin(holdings, and(eq(holdings.assetId, assets.id), eq(holdings.accountId, accountId)))
      .where(and(
        eq(assets.userId, userId),
        eq(assets.subKind, subKind),
        ...(currencyCode ? [eq(assets.currencyCode, currencyCode)] : []),
      ))
      .then(r => r[0] ?? null)
  }
}
```

- [ ] **Step 5: Update `assets.service.ts`**

Every public method gains `userId: string` as its first parameter and passes it to the repo:

```typescript
// api/src/modules/assets/assets.service.ts
import { AssetsRepository } from './assets.repository'
import { SnapshotItemsRepository } from '../snapshot-items/snapshot-items.repository'
import { PricesRepository } from '../prices/prices.repository'
import { AssetCreateInput, AssetUpdateInput } from './assets.schema'
import { HTTPException } from 'hono/http-exception'
import { fetchMarketPrices } from '../../jobs/pricing.service'

const ASSET_CATEGORIES = ['liquid', 'investment', 'fixed', 'receivable'] as const
const LIABILITY_CATEGORIES = ['debt'] as const

export class AssetsService {
  constructor(
    private repo: AssetsRepository,
    private snapshotRepo: SnapshotItemsRepository,
    private pricesRepo: PricesRepository,
  ) {}

  async findAll(userId: string) { return this.repo.findAll(userId) }

  async findById(id: string, userId: string) { return this.repo.findById(id, userId) }

  async createAsset(userId: string, data: AssetCreateInput) {
    if (data.assetClass === 'asset' && !ASSET_CATEGORIES.includes(data.category as any))
      throw new HTTPException(422, { message: 'Invalid category for assetClass=asset' })
    if (data.assetClass === 'liability' && !LIABILITY_CATEGORIES.includes(data.category as any))
      throw new HTTPException(422, { message: 'category must be debt for liability' })

    const asset = await this.repo.create({
      userId,
      name: data.name, assetClass: data.assetClass, category: data.category,
      subKind: data.subKind, symbol: data.symbol ?? null, market: data.market ?? null,
      currencyCode: data.currencyCode, pricingMode: data.pricingMode,
      unit: data.unit ?? null,
    })

    if (asset.pricingMode === 'market' && asset.symbol) {
      const today = new Date().toISOString().slice(0, 10)
      fetchMarketPrices([{ id: asset.id, symbol: asset.symbol, pricingMode: 'market', subKind: asset.subKind }])
        .then(pricesMap => {
          const price = pricesMap.get(asset.id)
          if (price != null) return this.pricesRepo.upsert(asset.id, today, String(price), 'yahoo-finance2')
        })
        .catch(err => console.warn('Price fetch failed for new asset:', err))
    }

    return asset
  }

  async updateAsset(id: string, userId: string, data: AssetUpdateInput) {
    const existing = await this.repo.findById(id, userId)
    if (!existing) throw new HTTPException(404, { message: 'Asset not found' })
    return this.repo.update(id, userId, {
      name: data.name, symbol: data.symbol ?? undefined, market: data.market ?? undefined,
      unit: data.unit ?? undefined,
    })
  }

  async deleteAsset(id: string, userId: string) {
    const existing = await this.repo.findById(id, userId)
    if (!existing) throw new HTTPException(404, { message: 'Asset not found' })
    return this.repo.delete(id, userId)
  }
}
```

- [ ] **Step 6: Update `assets.controller.ts`**

```typescript
// api/src/modules/assets/assets.controller.ts
import { Hono } from 'hono'
import { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { AssetsRepository } from './assets.repository'
import { AssetsService } from './assets.service'
import { SnapshotItemsRepository } from '../snapshot-items/snapshot-items.repository'
import { PricesRepository } from '../prices/prices.repository'
import { AssetCreateSchema, AssetUpdateSchema } from './assets.schema'

const assetsController = new Hono()
const repo = new AssetsRepository(db)
const snapshotRepo = new SnapshotItemsRepository(db)
const pricesRepo = new PricesRepository(db)
const service = new AssetsService(repo, snapshotRepo, pricesRepo)

function getUserId(c: Context): string | null {
  return c.req.header('x-user-id') ?? null
}

assetsController.get('/', async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  return c.json(await service.findAll(userId))
})

assetsController.get('/:id', async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  const asset = await service.findById(c.req.param('id'), userId)
  if (!asset) return c.json({ error: 'Not found' }, 404)
  return c.json(asset)
})

assetsController.post('/', zValidator('json', AssetCreateSchema), async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  return c.json(await service.createAsset(userId, c.req.valid('json')), 201)
})

assetsController.patch('/:id', zValidator('json', AssetUpdateSchema), async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  const asset = await service.updateAsset(c.req.param('id'), userId, c.req.valid('json'))
  return c.json(asset)
})

assetsController.delete('/:id', async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  await service.deleteAsset(c.req.param('id'), userId)
  return c.body(null, 204)
})

export default assetsController
```

- [ ] **Step 7: Apply the same pattern to all remaining modules**

The changes for `accounts`, `holdings`, `transactions`, `recurringEntries`, and `dashboard` follow the exact same pattern as assets above. For each module:

**`accounts.repository.ts`**: Add `userId: string` to `findAll`, `findById`, `create` (include `userId` in insert), `update`, `delete`. The `balance` subquery in `findAll` does not need changes since it joins on `accountId` which already belongs to the user. Add `eq(accounts.userId, userId)` to every `where`.

**`accounts.service.ts`**: Add `userId: string` to `findAll`, `createAccount`, `updateAccount`, `deleteAccount`, `setBalance`. In `setBalance`, pass `userId` when calling `assetRepo.findBySubKindAndCurrency`, `assetRepo.create` (add `userId` field), and `holdingsRepo.upsert`.

**`accounts.controller.ts`**: Same `getUserId` guard on all 5 handlers.

**`holdings.repository.ts`**: `findAll(userId, accountId?)` — add `eq(assets.userId, userId)` in the joined `where` clause. `findOne` is internal (called from service that already has userId context; add `userId` param and filter). `upsert` gains `userId` param and includes it in the `.values()` and `.onConflictDoUpdate()`. `delete` uses assetId+accountId (composite PK — no userId needed but the service validates user owns the asset first).

**`holdings.service.ts`**: All methods gain `userId` first param.

**`holdings.controller.ts`**: Same `getUserId` guard.

**`transactions.repository.ts`**: `findAll(userId, filters)` — add `eq(transactions.userId, userId)` to the query. `create` includes `userId`. `findById` adds `userId` guard. `updateNote` and `delete` also add `userId` to `where`.

**`transactions.service.ts`** and **`transactions.controller.ts`**: Same pattern.

**`recurringEntries.repository.ts`**: `findAll({ userId, assetId?, accountId? })` — add `userId` condition first. `create` includes `userId`. `update`/`delete` add `userId` to the `where`.

**`dashboard.repository.ts`**: All functions gain `userId: string` as first param after `db`. Add `eq(snapshotItems.userId, userId)` (and `eq(holdings.userId, userId)` for `getLiveHoldings`) to every `where`/`from` that touches user-owned tables. `getFxRateForDisplay` and `fxRates` queries remain unchanged (global data).

**`dashboard.service.ts`**: Extract `userId` from a passed param (not from `db`). Change all service functions to accept `userId: string` as first param. Since the service currently uses the module-level `db` singleton, the functions must be refactored to accept `userId` and pass it through to every repository call.

**`dashboard.controller.ts`**: Add `getUserId` guard to all 5 routes; pass `userId` to service calls.

- [ ] **Step 8: Run all existing tests to check overall breakage**

```bash
cd /Users/htchang/Desktop/AtomFortune/api && npm test -- --reporter=verbose
```

Expected: Many failures because existing tests don't yet send `X-User-Id` and don't seed a user. This is expected — Task 6 fixes the tests. Proceed to Task 4 and 5 first, then fix tests in Task 6.

- [ ] **Step 9: Commit**

```bash
cd /Users/htchang/Desktop/AtomFortune
git add api/src/modules/
git commit -m "feat(api): add userId filtering to all repositories and controllers"
```

---

## Task 4: Update Snapshot Job (Per-User Iteration)

**Files:**
- Modify: `api/src/jobs/snapshot.job.ts`

The snapshot job currently runs for all holdings globally. After this task it will: (1) fetch market prices once globally (prices are market data, not per-user), (2) fetch all users from the DB, (3) for each user, run the holdings iteration and write `snapshotItems` with that user's `userId`.

- [ ] **Step 1: Update `getAllHoldingsWithAssets` to accept `userId`**

```typescript
// In api/src/jobs/snapshot.job.ts

// Add users import to the schema imports at top:
import { assets, holdings, prices, fxRates, snapshotItems, users } from '../db/schema'

// Replace getAllHoldingsWithAssets:
export async function getAllHoldingsWithAssets(tx: DrizzleDB, userId: string) {
  return tx
    .select({
      assetId: holdings.assetId, accountId: holdings.accountId,
      quantity: holdings.quantity, pricingMode: assets.pricingMode,
      currencyCode: assets.currencyCode, subKind: assets.subKind, unit: assets.unit,
    })
    .from(holdings)
    .innerJoin(assets, eq(holdings.assetId, assets.id))
    .where(eq(holdings.userId, userId))
}

// Add a helper to get all users:
async function getAllUsers(db: DrizzleDB) {
  return db.select({ id: users.id }).from(users)
}
```

- [ ] **Step 2: Update `dailySnapshotJob` to iterate per user**

Replace the existing `dailySnapshotJob` function body with:

```typescript
export async function dailySnapshotJob(db: DrizzleDB, snapshotDate = new Date()): Promise<SnapshotJobResult> {
  const today = formatDate(snapshotDate)

  // Market prices are global — fetch once for all users
  const marketAssets = await getMarketAssets(db)
  let pricesMap = new Map<string, number>()
  try {
    pricesMap = await fetchMarketPrices(marketAssets)
    await upsertPrices(db, pricesMap, today)
  } catch (err) {
    console.warn('Market price fetch failed:', err)
  }

  const priceResults = marketAssets.map(a => ({
    assetId: a.id, name: a.name, symbol: a.symbol ?? '',
    price: pricesMap.get(a.id) ?? null,
    status: (pricesMap.has(a.id) ? 'ok' : 'failed') as 'ok' | 'failed',
  }))

  let fxStatus: 'ok' | 'failed' = 'failed'
  try {
    const rates = await fetchFxRates()
    await upsertFxRates(db, rates, today)
    fxStatus = 'ok'
  } catch (err) {
    console.warn('FX rate refresh failed:', err)
  }

  let snapshotItemsWritten = 0

  // Iterate per user
  const allUsers = await getAllUsers(db)

  for (const user of allUsers) {
    const holdingRows = await getAllHoldingsWithAssets(db, user.id)
    const resolvedItems: Array<{
      snapshotDate: string, assetId: string, accountId: string, userId: string,
      quantity: string, price: string, fxRate: string, valueInBase: string,
    }> = []
    const missingAssets: string[] = []

    for (const h of holdingRows) {
      const price = await resolvePrice(db, h.assetId, h.pricingMode, today)
      if (price === null) { missingAssets.push(h.assetId); continue }
      const fxRate = await resolveFxRate(db, h.currencyCode, today)
      const unitMultiplier = getUnitMultiplier(h.subKind, h.unit)
      const valueInBase = Number(h.quantity) * unitMultiplier * price * fxRate
      resolvedItems.push({
        snapshotDate: today, assetId: h.assetId, accountId: h.accountId,
        userId: user.id,
        quantity: h.quantity, price: String(price), fxRate: String(fxRate),
        valueInBase: String(valueInBase),
      })
    }

    if (missingAssets.length) console.warn(`[user ${user.id}] Missing assets:`, missingAssets)

    db.transaction((tx) => {
      tx.delete(snapshotItems)
        .where(and(eq(snapshotItems.snapshotDate, today), eq(snapshotItems.userId, user.id)))
        .run()
      for (const item of resolvedItems) {
        tx.insert(snapshotItems).values(item).run()
        snapshotItemsWritten++
      }
    })
  }

  return { date: today, prices: priceResults, fxStatus, snapshotItemsWritten }
}
```

- [ ] **Step 3: Commit (tests for this will be updated in Task 6)**

```bash
cd /Users/htchang/Desktop/AtomFortune
git add api/src/jobs/snapshot.job.ts
git commit -m "feat(snapshot): iterate per user in daily snapshot job"
```

---

## Task 5: Update Backup Controller (Per-User Scope + AES-256-GCM Encryption)

**Files:**
- Modify: `api/src/modules/backup/backup.controller.ts`

The backup controller currently operates on all data. After this task:
- Export reads `X-User-Id`, exports only that user's data, optionally encrypts with AES-256-GCM if `?password=` query param is provided.
- Import reads `X-User-Id` and `X-Backup-Password` header; if the zip contains a `.enc` file, decrypts before parsing; assigns all imported rows to the requesting user.
- Reset deletes only data belonging to the requesting user.

### AES-256-GCM Wire Format

```
[ salt(16) ][ iv(16) ][ authTag(16) ][ ciphertext(N) ]
```

Key derivation: `crypto.scryptSync(password, salt, 32)` — 32-byte key, default N=16384, r=8, p=1.

- [ ] **Step 1: Write failing encryption test in `api/tests/backup.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import app from '../src/index'
import { cleanDb, closeDb, testDb, seedTestUser } from './helpers/db'
import { assets, accounts, users } from '../src/db/schema'
import { unzipSync, strFromU8 } from 'fflate'

beforeEach(() => cleanDb())
afterAll(() => closeDb())

describe('GET /api/v1/backup/export (with X-User-Id)', () => {
  it('returns 400 when X-User-Id is missing', async () => {
    const res = await app.request('/api/v1/backup/export')
    expect(res.status).toBe(400)
  })

  it('returns a zip containing backup.json for correct user', async () => {
    const user = await seedTestUser()
    await testDb.insert(assets).values({
      userId: user.id,
      name: 'Cash', assetClass: 'asset', category: 'liquid',
      subKind: 'bank_account', currencyCode: 'TWD', pricingMode: 'fixed',
    })
    const res = await app.request('/api/v1/backup/export', {
      headers: { 'x-user-id': user.id },
    })
    expect(res.status).toBe(200)
    const buf = await res.arrayBuffer()
    const unzipped = unzipSync(new Uint8Array(buf))
    const filename = Object.keys(unzipped)[0]
    expect(filename).toMatch(/\.json$/)
    const parsed = JSON.parse(strFromU8(unzipped[filename]))
    expect(parsed.data.assets).toHaveLength(1)
    expect(parsed.data.assets[0].name).toBe('Cash')
  })

  it('returns encrypted .enc file when password is provided', async () => {
    const user = await seedTestUser()
    const res = await app.request('/api/v1/backup/export?password=s3cret', {
      headers: { 'x-user-id': user.id },
    })
    expect(res.status).toBe(200)
    const buf = await res.arrayBuffer()
    const unzipped = unzipSync(new Uint8Array(buf))
    const filename = Object.keys(unzipped)[0]
    expect(filename).toMatch(/\.enc$/)
    // Should be binary data, not parseable as JSON
    expect(() => JSON.parse(strFromU8(unzipped[filename]))).toThrow()
  })
})

describe('POST /api/v1/backup/import (with X-User-Id)', () => {
  it('imports encrypted backup when correct password provided', async () => {
    const user = await seedTestUser()
    // First export with encryption
    await testDb.insert(accounts).values({
      userId: user.id, name: 'MyBank', accountType: 'bank',
    })
    const exportRes = await app.request('/api/v1/backup/export?password=mypassword', {
      headers: { 'x-user-id': user.id },
    })
    const zipBuf = await exportRes.arrayBuffer()
    // Clean up and re-import
    cleanDb()
    const newUser = await seedTestUser()
    const form = new FormData()
    form.append('file', new Blob([zipBuf], { type: 'application/zip' }), 'backup.zip')
    const importRes = await app.request('/api/v1/backup/import', {
      method: 'POST',
      headers: { 'x-user-id': newUser.id, 'x-backup-password': 'mypassword' },
      body: form,
    })
    expect(importRes.status).toBe(200)
    const body = await importRes.json()
    expect(body.imported.accounts).toBe(1)
  })
})

describe('DELETE /api/v1/backup/reset (with X-User-Id)', () => {
  it('returns 400 when X-User-Id is missing', async () => {
    const res = await app.request('/api/v1/backup/reset', { method: 'DELETE' })
    expect(res.status).toBe(400)
  })

  it('deletes only the current user data and returns ok', async () => {
    const userA = await seedTestUser('User A')
    const userB = await seedTestUser('User B')
    await testDb.insert(assets).values({
      userId: userA.id,
      name: 'A-Asset', assetClass: 'asset', category: 'liquid',
      subKind: 'bank_account', currencyCode: 'TWD', pricingMode: 'fixed',
    })
    await testDb.insert(assets).values({
      userId: userB.id,
      name: 'B-Asset', assetClass: 'asset', category: 'liquid',
      subKind: 'bank_account', currencyCode: 'TWD', pricingMode: 'fixed',
    })
    const res = await app.request('/api/v1/backup/reset', {
      method: 'DELETE',
      headers: { 'x-user-id': userA.id },
    })
    expect(res.status).toBe(200)
    const remaining = await testDb.select().from(assets)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].name).toBe('B-Asset')
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
cd /Users/htchang/Desktop/AtomFortune/api && npm test -- --reporter=verbose tests/backup.test.ts
```

Expected: failures.

- [ ] **Step 3: Rewrite `backup.controller.ts`**

```typescript
// api/src/modules/backup/backup.controller.ts
import { Hono } from 'hono'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'
import { db } from '../../db/client'
import {
  assets, accounts, holdings, transactions,
  prices, fxRates, snapshotItems, recurringEntries,
} from '../../db/schema'

export const backupRouter = new Hono()

// Strip auto-managed timestamp columns
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function strip(row: Record<string, any>): any {
  const { createdAt: _c, updatedAt: _u, ...rest } = row
  return rest
}

// ── AES-256-GCM helpers ─────────────────────────────────────────────────────

function encryptBackup(plaintext: string, password: string): Uint8Array {
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(16)
  const key = crypto.scryptSync(password, salt, 32)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Wire format: salt(16) + iv(16) + authTag(16) + ciphertext
  return new Uint8Array(Buffer.concat([salt, iv, authTag, encrypted]))
}

function decryptBackup(data: Uint8Array, password: string): string {
  const buf = Buffer.from(data)
  const salt = buf.subarray(0, 16)
  const iv = buf.subarray(16, 32)
  const authTag = buf.subarray(32, 48)
  const ciphertext = buf.subarray(48)
  const key = crypto.scryptSync(password, salt, 32)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(ciphertext) + decipher.final('utf8')
}

// ── Export ───────────────────────────────────────────────────────────────────

backupRouter.get('/export', async (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)

  const password = c.req.query('password')
  const date = new Date().toISOString().slice(0, 10)

  const [
    assetRows, accountRows, holdingRows, txnRows,
    priceRows, fxRows, snapshotRows, recurringRows,
  ] = await Promise.all([
    db.select().from(assets).where(eq(assets.userId, userId)),
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(holdings).where(eq(holdings.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
    db.select().from(prices),          // global
    db.select().from(fxRates),         // global
    db.select().from(snapshotItems).where(eq(snapshotItems.userId, userId)),
    db.select().from(recurringEntries).where(eq(recurringEntries.userId, userId)),
  ])

  const payload = {
    version: '2',
    exportedAt: new Date().toISOString(),
    data: {
      assets: assetRows,
      accounts: accountRows,
      holdings: holdingRows,
      transactions: txnRows,
      prices: priceRows,
      fxRates: fxRows,
      snapshotItems: snapshotRows,
      recurringEntries: recurringRows,
    },
  }

  const jsonStr = JSON.stringify(payload, null, 2)

  let fileEntry: Record<string, Uint8Array>
  let baseFilename: string

  if (password) {
    baseFilename = `atomfortune-backup-${date}.enc`
    fileEntry = { [baseFilename]: encryptBackup(jsonStr, password) }
  } else {
    baseFilename = `atomfortune-backup-${date}.json`
    fileEntry = { [baseFilename]: strToU8(jsonStr) }
  }

  const zipped = zipSync(fileEntry)
  const zipFilename = baseFilename.replace(/\.(json|enc)$/, '.zip')

  c.header('Content-Disposition', `attachment; filename="${zipFilename}"`)
  c.header('Content-Type', 'application/zip')
  return c.body(zipped.buffer as ArrayBuffer)
})

// ── Import ────────────────────────────────────────────────────────────────────

backupRouter.post('/import', async (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)

  const contentType = c.req.header('content-type') ?? ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    if (!file) return c.json({ error: 'Missing file field' }, 400)

    const buf = await file.arrayBuffer()
    try {
      const unzipped = unzipSync(new Uint8Array(buf))
      const filename = Object.keys(unzipped)[0]
      const fileData = unzipped[filename]

      if (filename.endsWith('.enc')) {
        const password = c.req.header('x-backup-password')
        if (!password) return c.json({ error: 'Missing X-Backup-Password header for encrypted backup' }, 400)
        try {
          const decrypted = decryptBackup(fileData, password)
          body = JSON.parse(decrypted)
        } catch {
          return c.json({ error: 'Decryption failed — wrong password or corrupted file' }, 400)
        }
      } else {
        body = JSON.parse(strFromU8(fileData))
      }
    } catch (e) {
      return c.json({ error: 'Failed to unzip or parse backup file' }, 400)
    }
  } else {
    try { body = await c.req.json() } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
  }

  if (!['1', '2'].includes(body.version) || !body.data) {
    return c.json({ error: 'Unsupported backup format' }, 400)
  }

  const d = body.data
  const counts = {
    assets: 0, accounts: 0, holdings: 0, transactions: 0,
    prices: 0, fxRates: 0, snapshotItems: 0, recurringEntries: 0,
  }

  db.transaction((tx) => {
    if (Array.isArray(d.assets) && d.assets.length) {
      for (const row of d.assets) {
        const v = { ...strip(row), userId }
        tx.insert(assets).values(v)
          .onConflictDoUpdate({ target: assets.id, set: {
            name: v.name, assetClass: v.assetClass, category: v.category,
            subKind: v.subKind, symbol: v.symbol, market: v.market,
            currencyCode: v.currencyCode, pricingMode: v.pricingMode, unit: v.unit,
          }}).run()
      }
      counts.assets = d.assets.length
    }

    if (Array.isArray(d.accounts) && d.accounts.length) {
      for (const row of d.accounts) {
        const v = { ...strip(row), userId }
        tx.insert(accounts).values(v)
          .onConflictDoUpdate({ target: accounts.id, set: {
            name: v.name, institution: v.institution,
            accountType: v.accountType, note: v.note,
          }}).run()
      }
      counts.accounts = d.accounts.length
    }

    if (Array.isArray(d.holdings) && d.holdings.length) {
      for (const row of d.holdings) {
        const v = { ...strip(row), userId }
        tx.insert(holdings).values(v)
          .onConflictDoUpdate({ target: [holdings.assetId, holdings.accountId], set: {
            quantity: v.quantity,
          }}).run()
      }
      counts.holdings = d.holdings.length
    }

    if (Array.isArray(d.transactions) && d.transactions.length) {
      for (const row of d.transactions) {
        const v = { ...strip(row), userId }
        tx.insert(transactions).values(v)
          .onConflictDoUpdate({ target: transactions.id, set: {
            txnType: v.txnType, quantity: v.quantity, txnDate: v.txnDate, note: v.note,
          }}).run()
      }
      counts.transactions = d.transactions.length
    }

    if (Array.isArray(d.prices) && d.prices.length) {
      for (const row of d.prices) {
        const v = strip(row)
        tx.insert(prices).values(v)
          .onConflictDoUpdate({ target: [prices.assetId, prices.priceDate], set: {
            price: v.price, source: v.source,
          }}).run()
      }
      counts.prices = d.prices.length
    }

    if (Array.isArray(d.fxRates) && d.fxRates.length) {
      for (const row of d.fxRates) {
        const v = strip(row)
        tx.insert(fxRates).values(v)
          .onConflictDoUpdate({
            target: [fxRates.fromCurrency, fxRates.toCurrency, fxRates.rateDate],
            set: { rate: v.rate, source: v.source },
          }).run()
      }
      counts.fxRates = d.fxRates.length
    }

    if (Array.isArray(d.snapshotItems) && d.snapshotItems.length) {
      for (const row of d.snapshotItems) {
        const v = { ...strip(row), userId }
        tx.insert(snapshotItems).values(v)
          .onConflictDoUpdate({
            target: [snapshotItems.snapshotDate, snapshotItems.assetId, snapshotItems.accountId],
            set: {
              quantity: v.quantity, price: v.price,
              fxRate: v.fxRate, valueInBase: v.valueInBase,
            },
          }).run()
      }
      counts.snapshotItems = d.snapshotItems.length
    }

    if (Array.isArray(d.recurringEntries) && d.recurringEntries.length) {
      for (const row of d.recurringEntries) {
        const v = { ...strip(row), userId }
        tx.insert(recurringEntries).values(v)
          .onConflictDoUpdate({ target: recurringEntries.id, set: {
            type: v.type, amount: v.amount, currencyCode: v.currencyCode,
            dayOfMonth: v.dayOfMonth, label: v.label,
            effectiveFrom: v.effectiveFrom, effectiveTo: v.effectiveTo,
          }}).run()
      }
      counts.recurringEntries = d.recurringEntries.length
    }
  })

  return c.json({ ok: true, imported: counts })
})

// ── Reset ─────────────────────────────────────────────────────────────────────

backupRouter.delete('/reset', (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)

  db.transaction((tx) => {
    tx.delete(snapshotItems).where(eq(snapshotItems.userId, userId)).run()
    tx.delete(recurringEntries).where(eq(recurringEntries.userId, userId)).run()
    tx.delete(transactions).where(eq(transactions.userId, userId)).run()
    tx.delete(holdings).where(eq(holdings.userId, userId)).run()
    tx.delete(accounts).where(eq(accounts.userId, userId)).run()
    tx.delete(assets).where(eq(assets.userId, userId)).run()
  })
  return c.json({ ok: true })
})
```

- [ ] **Step 4: Run backup tests**

```bash
cd /Users/htchang/Desktop/AtomFortune/api && npm test -- --reporter=verbose tests/backup.test.ts
```

Expected: all backup tests PASS (after Task 6 updates `cleanDb` and `seedTestUser`).

- [ ] **Step 5: Commit**

```bash
cd /Users/htchang/Desktop/AtomFortune
git add api/src/modules/backup/backup.controller.ts api/tests/backup.test.ts
git commit -m "feat(backup): per-user scope and AES-256-GCM encrypted export/import"
```

---

## Task 6: Update Test Helpers and All Existing Tests

**Files:**
- Modify: `api/tests/helpers/db.ts`
- Modify: `api/tests/assets.test.ts`
- Modify: `api/tests/accounts.test.ts`
- Modify: `api/tests/holdings.test.ts`
- Modify: `api/tests/transactions.test.ts`
- Modify: `api/tests/backup.test.ts` (already done in Task 5)

### Updated `api/tests/helpers/db.ts`

- [ ] **Step 1: Rewrite the helpers file**

```typescript
// api/tests/helpers/db.ts
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { sql } from 'drizzle-orm'
import path from 'path'
import { db } from '../../src/db/client'
import { users } from '../../src/db/schema'

// Run migrations once when test suite loads
migrate(db, { migrationsFolder: path.join(__dirname, '../../drizzle') })

export const testDb = db

export function cleanDb() {
  db.run(sql`DELETE FROM snapshotItems`)
  db.run(sql`DELETE FROM recurringEntries`)
  db.run(sql`DELETE FROM transactions`)
  db.run(sql`DELETE FROM holdings`)
  db.run(sql`DELETE FROM prices`)
  db.run(sql`DELETE FROM fxRates`)
  db.run(sql`DELETE FROM accounts`)
  db.run(sql`DELETE FROM assets`)
  db.run(sql`DELETE FROM tickers`)
  db.run(sql`DELETE FROM users`)
}

// Creates a user and returns it. Pass a name for multi-user tests.
export async function seedTestUser(name = 'Test User') {
  const [user] = await db.insert(users).values({ name }).returning()
  return user
}

export function closeDb() {
  // no-op: better-sqlite3 closes on process exit
}
```

### Updated `api/tests/assets.test.ts` — Complete Rewrite (Pattern for All Other Tests)

- [ ] **Step 2: Rewrite `assets.test.ts` to use `seedTestUser` and send `X-User-Id`**

```typescript
// api/tests/assets.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import app from '../src/index'
import { cleanDb, closeDb, seedTestUser } from './helpers/db'

let userId: string

beforeEach(async () => {
  cleanDb()
  const user = await seedTestUser()
  userId = user.id
})
afterAll(() => closeDb())

const userHeader = () => ({ 'x-user-id': userId })

describe('POST /api/v1/assets', () => {
  it('creates an asset and returns 201', async () => {
    const res = await app.request('/api/v1/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userHeader() },
      body: JSON.stringify({
        name: 'AAPL', assetClass: 'asset', category: 'investment',
        subKind: 'stock', symbol: 'AAPL', market: 'NASDAQ',
        currencyCode: 'USD', pricingMode: 'market',
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBeDefined()
    expect(body.name).toBe('AAPL')
  })

  it('returns 400 when X-User-Id header is missing', async () => {
    const res = await app.request('/api/v1/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'AAPL', assetClass: 'asset', category: 'investment',
        subKind: 'stock', currencyCode: 'USD', pricingMode: 'market',
      }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Missing X-User-Id header')
  })

  it('returns 422 for invalid assetClass/category combo', async () => {
    const res = await app.request('/api/v1/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userHeader() },
      body: JSON.stringify({
        name: 'Bad', assetClass: 'liability', category: 'investment',
        subKind: 'stock', currencyCode: 'TWD', pricingMode: 'fixed',
      }),
    })
    expect(res.status).toBe(422)
  })
})

describe('GET /api/v1/assets', () => {
  it('returns empty array when no assets', async () => {
    const res = await app.request('/api/v1/assets', {
      headers: userHeader(),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('only returns assets belonging to the requesting user', async () => {
    // Create asset for user A (our test user, userId)
    await app.request('/api/v1/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userHeader() },
      body: JSON.stringify({ name: 'Mine', assetClass: 'asset', category: 'investment',
        subKind: 'stock', currencyCode: 'USD', pricingMode: 'market' }),
    })
    // Create a second user and their asset
    const { seedTestUser: seed2 } = await import('./helpers/db')
    const userB = await seed2('User B')
    await app.request('/api/v1/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userB.id },
      body: JSON.stringify({ name: 'Theirs', assetClass: 'asset', category: 'investment',
        subKind: 'stock', currencyCode: 'USD', pricingMode: 'market' }),
    })
    // User A should only see their own asset
    const res = await app.request('/api/v1/assets', { headers: userHeader() })
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('Mine')
  })
})

describe('PATCH /api/v1/assets/:id', () => {
  it('updates mutable fields name/symbol/market', async () => {
    const create = await app.request('/api/v1/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userHeader() },
      body: JSON.stringify({ name: 'TSLA', assetClass: 'asset', category: 'investment',
        subKind: 'stock', currencyCode: 'USD', pricingMode: 'market' }),
    })
    const { id } = await create.json()
    const res = await app.request(`/api/v1/assets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...userHeader() },
      body: JSON.stringify({ name: 'Tesla Inc', symbol: 'TSLA', market: 'NASDAQ' }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).name).toBe('Tesla Inc')
  })
})

describe('DELETE /api/v1/assets/:id', () => {
  it('deletes an asset and returns 204', async () => {
    const create = await app.request('/api/v1/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userHeader() },
      body: JSON.stringify({ name: 'DEL', assetClass: 'asset', category: 'liquid',
        subKind: 'bank_account', currencyCode: 'TWD', pricingMode: 'fixed' }),
    })
    const { id } = await create.json()
    const res = await app.request(`/api/v1/assets/${id}`, {
      method: 'DELETE',
      headers: userHeader(),
    })
    expect(res.status).toBe(204)
  })
})
```

### Pattern for remaining test files

- [ ] **Step 3: Update `accounts.test.ts`**

Follow the exact same pattern: add `let userId: string`, add `beforeEach` that calls `cleanDb()` then `seedTestUser()`, add `userHeader()` helper, and send the header on every `app.request()` call. Where tests insert directly via `testDb.insert(accounts)`, also include `userId` in the values:

```typescript
// Key differences from assets.test.ts:
// All testDb.insert(accounts).values({ ... }) must include userId: userId
// All testDb.insert(assets).values({ ... }) must include userId: userId
// All app.request() calls must include headers: { ...userHeader() }
```

- [ ] **Step 4: Update `holdings.test.ts`**

Same pattern. The `seedAssetAndAccount` helper inside the file must be updated:

```typescript
const seedAssetAndAccount = async () => {
  const [asset] = await testDb.insert(assets).values({
    userId,  // add this
    name: 'BTC', assetClass: 'asset', category: 'investment',
    subKind: 'crypto', currencyCode: 'USD', pricingMode: 'market',
  }).returning()
  const [account] = await testDb.insert(accounts).values({
    userId,  // add this
    name: 'Binance', accountType: 'crypto_exchange',
  }).returning()
  return { asset, account }
}
```

All `app.request()` calls add `headers: { ...userHeader() }`. The PUT holding upsert also needs to include `userId` — but the holdings controller reads it from the header, so the header addition is sufficient.

- [ ] **Step 5: Update `transactions.test.ts`**

Same pattern. `seedAssetAndAccount` gains `userId`. All `app.request()` calls get `headers: { ...userHeader() }`.

- [ ] **Step 6: Run the full test suite — expect passing**

```bash
cd /Users/htchang/Desktop/AtomFortune/api && npm test -- --reporter=verbose
```

Expected: all tests PASS. (The `snapshot-job.test.ts` and `dashboard.test.ts` use mocks so they should still pass; verify.)

- [ ] **Step 7: Commit**

```bash
cd /Users/htchang/Desktop/AtomFortune
git add api/tests/
git commit -m "test: update all test helpers and test files to use userId with X-User-Id header"
```

---

## Task 7: Web Layer

**Files:**
- Create: `web/lib/user.ts`
- Modify: `web/lib/api.ts`
- Modify: `web/app/settings/page.tsx`
- Modify: `web/app/snapshots/page.tsx`
- Modify: `web/components/snapshots/SnapshotsList.tsx`
- Modify: `web/components/holdings/HoldingSidePanel.tsx`
- Modify: `web/components/accounts/AccountSidePanel.tsx`
- Modify: `web/components/assets/AssetFormModal.tsx`
- Modify: `web/components/assets/RecurringEntriesPanel.tsx`
- Modify: `web/components/assets/ManualPriceModal.tsx`
- Modify: `web/components/assets/AssetSidePanel.tsx`
- Modify: `web/components/assets/AssetDetailView.tsx`
- Modify: `web/components/dashboard/NetWorthChart.tsx`
- Modify: `web/components/assets/TickerSearch.tsx`
- Create: `web/components/layout/UserSwitcher.tsx`
- Modify: `web/components/layout/Sidebar.tsx`
- Modify: `web/messages/en.json`
- Modify: `web/messages/zh-TW.json`

- [ ] **Step 1: Create `web/lib/user.ts` — localStorage helpers**

```typescript
// web/lib/user.ts
'use client'

const UID_KEY = 'atomfortune_uid'
const DEFAULT_USER_ID = 'default-user'

/**
 * Returns the active user ID from localStorage.
 * Falls back to 'default-user' if not set (matches the backfilled migration default).
 */
export function getActiveUserId(): string {
  if (typeof window === 'undefined') return DEFAULT_USER_ID
  return localStorage.getItem(UID_KEY) ?? DEFAULT_USER_ID
}

export function setActiveUserId(id: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(UID_KEY, id)
}

/**
 * Ensures an active user ID is set. If localStorage is empty,
 * sets it to 'default-user'. Returns the active ID.
 */
export function ensureActiveUserId(): string {
  const current = getActiveUserId()
  if (!localStorage.getItem(UID_KEY)) {
    setActiveUserId(current)
  }
  return current
}
```

- [ ] **Step 2: Update `web/lib/api.ts` — inject `X-User-Id` in `fetcher`**

Replace the `fetcher` function so it reads from localStorage and adds the header. Because `api.ts` is used in both server and client contexts via SWR, `getActiveUserId()` is safe to call only when `window` is defined:

```typescript
// web/lib/api.ts — modified fetcher only (keep all useSWR hooks unchanged)
import useSWR from 'swr'
import { getActiveUserId } from './user'
import type { Currency, DashboardSummary, AllocationData, NetWorthHistory, CategoryHistory, LiveDashboard, RecurringEntry } from './types'

export const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1'

export const fetcher = (url: string) => {
  const userId = getActiveUserId()
  return fetch(url, {
    headers: { 'x-user-id': userId },
  }).then(r => {
    if (!r.ok) throw new Error(r.statusText)
    return r.json()
  })
}

// ... all useSWR hooks remain unchanged
```

- [ ] **Step 3: Create a `fetchWithUser` helper for direct `fetch()` calls**

Since there are ~12 files with direct `fetch()` calls, a helper avoids repeating the header logic:

Add this to `web/lib/user.ts`:

```typescript
/**
 * Wrapper around fetch() that automatically injects X-User-Id header.
 * Use this everywhere a component calls fetch() directly.
 */
export function fetchWithUser(input: string, init?: RequestInit): Promise<Response> {
  const userId = getActiveUserId()
  const headers = new Headers(init?.headers)
  headers.set('x-user-id', userId)
  return fetch(input, { ...init, headers })
}
```

- [ ] **Step 4: Update all direct `fetch()` calls to use `fetchWithUser`**

For each of the following files, replace every `fetch(url, ...)` call with `fetchWithUser(url, ...)` and add the import `import { fetchWithUser } from '@/lib/user'`. The call signatures are identical — only the function name changes and the `x-user-id` header is automatically included.

Files to update (each has 1–4 `fetch()` calls):
- `web/app/settings/page.tsx` — lines with `fetch(\`${BASE}/backup/import\`, ...)` and `fetch(\`${BASE}/backup/reset\`, ...)`
- `web/app/snapshots/page.tsx` — `fetch(\`${BASE}/snapshots/trigger\`, ...)` and `fetch(\`${BASE}/snapshots/rebuild/${date}\`, ...)`
- `web/components/snapshots/SnapshotsList.tsx`
- `web/components/holdings/HoldingSidePanel.tsx`
- `web/components/accounts/AccountSidePanel.tsx`
- `web/components/assets/AssetFormModal.tsx`
- `web/components/assets/RecurringEntriesPanel.tsx`
- `web/components/assets/ManualPriceModal.tsx`
- `web/components/assets/AssetSidePanel.tsx`
- `web/components/assets/AssetDetailView.tsx`
- `web/components/dashboard/NetWorthChart.tsx`
- `web/components/assets/TickerSearch.tsx`

For `settings/page.tsx` the export button also changes. The current `handleExport` opens `window.open(BASE + '/backup/export', '_blank')`. With the user ID requirement, change this to a `fetchWithUser` call that triggers a programmatic download:

```typescript
// In settings/page.tsx, replace handleExport:
async function handleExport() {
  const res = await fetchWithUser(`${BASE}/backup/export`)
  if (!res.ok) return
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const date = new Date().toISOString().slice(0, 10)
  a.download = `atomfortune-backup-${date}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
```

The password modal for export and import (Feature 2 web UI) is out of scope for the MVP of this plan — the API supports it via query param and header, but the web UI changes for the password modal dialog can be added in a follow-up. The current `handleExport` and `handleImport` will work correctly without passwords using the above changes.

- [ ] **Step 5: Create `web/components/layout/UserSwitcher.tsx`**

```tsx
// web/components/layout/UserSwitcher.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Plus, Check, User } from 'lucide-react'
import { BASE } from '@/lib/api'
import { getActiveUserId, setActiveUserId, fetchWithUser } from '@/lib/user'

type UserRecord = { id: string; name: string }

export default function UserSwitcher() {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<UserRecord[]>([])
  const [activeId, setActiveId] = useState<string>('default-user')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setActiveId(getActiveUserId())
    fetchUsers()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setNewName('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function fetchUsers() {
    try {
      const res = await fetch(`${BASE}/users`)
      if (res.ok) setUsers(await res.json())
    } catch { /* silently fail */ }
  }

  function handleSwitch(id: string) {
    setActiveUserId(id)
    setActiveId(id)
    setOpen(false)
    // Reload the page so all SWR caches are cleared for the new user
    window.location.reload()
  }

  async function handleCreate() {
    if (!newName.trim()) return
    const res = await fetch(`${BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    if (res.ok) {
      const user: UserRecord = await res.json()
      setUsers(prev => [...prev, user])
      setActiveUserId(user.id)
      setActiveId(user.id)
      setCreating(false)
      setNewName('')
      setOpen(false)
      window.location.reload()
    }
  }

  const activeUser = users.find(u => u.id === activeId)
  const initial = (activeUser?.name ?? 'D').charAt(0).toUpperCase()

  return (
    <div className="relative mx-2 mb-4" ref={dropdownRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
          hover:bg-bg text-[var(--color-text)] text-sm transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center
          text-xs font-bold shrink-0">
          {initial}
        </span>
        <span className="flex-1 text-left truncate font-medium">
          {activeUser?.name ?? t('userSwitcher.defaultUser')}
        </span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface border border-border
          rounded-xl shadow-lg overflow-hidden z-50">
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => handleSwitch(u.id)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm
                hover:bg-bg transition-colors text-left"
            >
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center
                justify-center text-xs font-bold shrink-0">
                {u.name.charAt(0).toUpperCase()}
              </span>
              <span className="flex-1 truncate">{u.name}</span>
              {u.id === activeId && <Check size={14} className="text-accent shrink-0" />}
            </button>
          ))}

          <div className="border-t border-border">
            {creating ? (
              <div className="px-3 py-2 flex gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewName('') } }}
                  placeholder={t('userSwitcher.newProfilePlaceholder')}
                  className="flex-1 text-sm px-2 py-1 rounded border border-border bg-bg
                    focus:outline-none focus:border-accent placeholder:text-muted"
                />
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="text-xs px-2 py-1 rounded bg-accent text-white disabled:opacity-50"
                >
                  {t('common.create')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm
                  text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-bg transition-colors"
              >
                <Plus size={14} />
                {t('userSwitcher.newProfile')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Update `web/components/layout/Sidebar.tsx` to include UserSwitcher**

```tsx
// web/components/layout/Sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { LayoutDashboard, Wallet, Briefcase, Building2, Camera, Settings, FlaskConical } from 'lucide-react'
import UserSwitcher from './UserSwitcher'

const NAV_ITEMS = [
  { href: '/',          key: 'nav.dashboard',  Icon: LayoutDashboard },
  { href: '/holdings',  key: 'nav.holdings',   Icon: Wallet },
  { href: '/assets',    key: 'nav.assets',     Icon: Briefcase },
  { href: '/accounts',  key: 'nav.accounts',   Icon: Building2 },
  { href: '/snapshots', key: 'nav.snapshots',  Icon: Camera },
] as const

export default function Sidebar() {
  const path = usePathname()
  const t = useTranslations()
  const [experimental, setExperimental] = useState(false)

  useEffect(() => {
    const check = () => setExperimental(document.documentElement.dataset.experimental === 'true')
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-experimental'] })
    return () => observer.disconnect()
  }, [])

  const linkClass = (href: string) =>
    `flex items-center gap-3 px-5 py-2.5 text-sm rounded-lg mx-2 transition-colors
    ${path === href ? 'bg-accent text-white' : 'text-[var(--color-text)] hover:bg-bg'}`

  return (
    <nav className="w-56 min-h-screen bg-surface border-r border-border flex flex-col pt-6 gap-1">
      {NAV_ITEMS.map(({ href, key, Icon }) => (
        <Link key={href} href={href} className={linkClass(href)}>
          <Icon size={16} />{t(key)}
        </Link>
      ))}
      {experimental && (
        <Link href="/experimental" className={linkClass('/experimental')}>
          <FlaskConical size={16} />{t('nav.experimental')}
        </Link>
      )}
      <Link href="/settings" className={linkClass('/settings')}>
        <Settings size={16} />{t('nav.settings')}
      </Link>

      {/* Spacer pushes UserSwitcher to the bottom */}
      <div className="flex-1" />
      <UserSwitcher />
    </nav>
  )
}
```

- [ ] **Step 7: Add i18n strings to `web/messages/en.json`**

Add the following section at the end of the root JSON object (before the closing `}`):

```json
"userSwitcher": {
  "defaultUser": "Default",
  "newProfile": "New profile",
  "newProfilePlaceholder": "Profile name…",
  "switchConfirm": "Switch to this profile?"
}
```

- [ ] **Step 8: Add i18n strings to `web/messages/zh-TW.json`**

Add the same section with Traditional Chinese translations:

```json
"userSwitcher": {
  "defaultUser": "預設使用者",
  "newProfile": "新增個人檔案",
  "newProfilePlaceholder": "輸入名稱…",
  "switchConfirm": "切換至此個人檔案？"
}
```

- [ ] **Step 9: Initialize default user on app start**

In `web/app/layout.tsx`, add a client-side effect to call `ensureActiveUserId()` so that new installs are automatically set to `default-user`:

```tsx
// Add to web/app/layout.tsx, in the RootLayout or a 'use client' child component:
// At the top of layout.tsx (if it's already 'use client') or in a new ClientInit component:

// If layout.tsx is NOT 'use client', create web/components/ClientInit.tsx:
```

```tsx
// web/components/ClientInit.tsx
'use client'
import { useEffect } from 'react'
import { ensureActiveUserId } from '@/lib/user'

export default function ClientInit() {
  useEffect(() => {
    ensureActiveUserId()
  }, [])
  return null
}
```

Then in `web/app/layout.tsx`, render `<ClientInit />` inside the body:

```tsx
// In web/app/layout.tsx:
import ClientInit from '@/components/ClientInit'

// Inside the <body> tag, add:
<ClientInit />
```

- [ ] **Step 10: Verify the web builds without errors**

```bash
cd /Users/htchang/Desktop/AtomFortune/web && npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors, build completes successfully.

- [ ] **Step 11: Commit**

```bash
cd /Users/htchang/Desktop/AtomFortune
git add web/lib/user.ts web/lib/api.ts web/components/layout/ web/components/ \
  web/app/settings/page.tsx web/app/snapshots/page.tsx \
  web/messages/en.json web/messages/zh-TW.json
git commit -m "feat(web): add user switcher, inject X-User-Id header into all fetch calls"
```

---

## Final Verification

- [ ] **Run full API test suite**

```bash
cd /Users/htchang/Desktop/AtomFortune/api && npm test -- --reporter=verbose
```

Expected: All tests PASS. Zero failures.

- [ ] **Smoke test the API with curl**

```bash
# Create a user
curl -s -X POST http://localhost:8001/api/v1/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alice"}' | jq .

# Create an asset for that user (replace <user-id> with the id returned above)
curl -s -X POST http://localhost:8001/api/v1/assets \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: <user-id>' \
  -d '{"name":"AAPL","assetClass":"asset","category":"investment","subKind":"stock","currencyCode":"USD","pricingMode":"market"}' | jq .

# Verify missing header returns 400
curl -s -X GET http://localhost:8001/api/v1/assets | jq .error
# Expected: "Missing X-User-Id header"

# Export backup without password
curl -s -o backup-test.zip -H 'x-user-id: <user-id>' \
  http://localhost:8001/api/v1/backup/export
unzip -l backup-test.zip

# Export backup with password
curl -s -o backup-enc.zip -H 'x-user-id: <user-id>' \
  'http://localhost:8001/api/v1/backup/export?password=testpw'
unzip -l backup-enc.zip
# Expected: shows .enc file inside zip
```

- [ ] **Final commit with release note**

```bash
cd /Users/htchang/Desktop/AtomFortune
git add -A
git commit -m "feat: multi-user profiles + encrypted backup complete"
```

---

### Critical Files for Implementation

- `/Users/htchang/Desktop/AtomFortune/api/src/db/schema.ts` - Core schema: add `users` table and `userId` FK to 6 tables; this drives the migration and all repository changes
- `/Users/htchang/Desktop/AtomFortune/api/drizzle/0001_multi_user.sql` - Migration file: creates `users` table, adds `userId` columns, backfills `default-user`; must be correct before any code compiles against the new schema
- `/Users/htchang/Desktop/AtomFortune/api/src/modules/assets/assets.repository.ts` - Reference implementation of the userId-filtering pattern for all repositories
- `/Users/htchang/Desktop/AtomFortune/api/tests/helpers/db.ts` - Test helpers: updated `cleanDb` (must delete `users` table) and new `seedTestUser` function used by every test file
- `/Users/htchang/Desktop/AtomFortune/web/lib/user.ts` - New file: `getActiveUserId`, `setActiveUserId`, `fetchWithUser` — central point for all user identity logic in the web layer

---

Since this is a READ-ONLY planning session, I cannot write the file directly. The complete plan content above needs to be saved to `/Users/htchang/Desktop/AtomFortune/docs/superpowers/plans/2026-03-24-multi-user-profiles.md`.

**Plan complete. Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task with review between tasks. Fast iteration, isolated context per task.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
