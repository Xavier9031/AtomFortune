import { sqliteTable, text, numeric, integer, primaryKey } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const tickers = sqliteTable('tickers', {
  symbol: text('symbol').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),      // 'stock' | 'etf'
  exchange: text('exchange'),        // 'TWSE' | 'TPEX' | 'NASDAQ' | 'NYSE' ...
  country: text('country'),          // 'TW' | 'US'
  updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
})

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

export const holdings = sqliteTable('holdings', {
  assetId: text('assetId').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  accountId: text('accountId').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  quantity: numeric('quantity').notNull(),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({ pk: primaryKey({ columns: [t.assetId, t.accountId] }) }))

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

export const prices = sqliteTable('prices', {
  assetId: text('assetId').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  priceDate: text('priceDate').notNull(),
  price: numeric('price').notNull(),
  source: text('source').notNull(),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({ pk: primaryKey({ columns: [t.assetId, t.priceDate] }) }))

export const fxRates = sqliteTable('fxRates', {
  fromCurrency: text('fromCurrency').notNull(),
  toCurrency: text('toCurrency').notNull(),
  rateDate: text('rateDate').notNull(),
  rate: numeric('rate').notNull(),
  source: text('source').notNull(),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({ pk: primaryKey({ columns: [t.fromCurrency, t.toCurrency, t.rateDate] }) }))

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

export const recurringEntries = sqliteTable('recurringEntries', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assetId: text('assetId').references(() => assets.id, { onDelete: 'cascade' }),
  accountId: text('accountId').references(() => accounts.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  amount: numeric('amount').notNull(),
  quantity: numeric('quantity'),
  currencyCode: text('currencyCode').notNull().default('TWD'),
  dayOfMonth: integer('dayOfMonth').notNull().default(1),
  label: text('label'),
  effectiveFrom: text('effectiveFrom').notNull(),
  effectiveTo: text('effectiveTo'),
  lastAppliedDate: text('lastAppliedDate'),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
})
