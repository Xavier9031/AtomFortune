import { pgTable, uuid, text, numeric, date, timestamp, primaryKey } from 'drizzle-orm/pg-core'

export const tickers = pgTable('tickers', {
  symbol: text('symbol').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),      // 'stock' | 'etf'
  exchange: text('exchange'),        // 'TWSE' | 'TPEX' | 'NASDAQ' | 'NYSE' ...
  country: text('country'),          // 'TW' | 'US'
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  assetClass: text('assetClass').notNull(),
  category: text('category').notNull(),
  subKind: text('subKind').notNull(),
  symbol: text('symbol'),
  market: text('market'),
  currencyCode: text('currencyCode').notNull(),
  pricingMode: text('pricingMode').notNull(),
  unit: text('unit'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  institution: text('institution'),
  accountType: text('accountType').notNull(),
  note: text('note'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})

export const holdings = pgTable('holdings', {
  assetId: uuid('assetId').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  accountId: uuid('accountId').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  quantity: numeric('quantity', { precision: 24, scale: 8 }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.assetId, t.accountId] }) }))

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  assetId: uuid('assetId').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  accountId: uuid('accountId').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  txnType: text('txnType').notNull(),
  quantity: numeric('quantity', { precision: 24, scale: 8 }).notNull(),
  txnDate: date('txnDate').notNull(),
  note: text('note'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})

export const prices = pgTable('prices', {
  assetId: uuid('assetId').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  priceDate: date('priceDate').notNull(),
  price: numeric('price', { precision: 24, scale: 8 }).notNull(),
  source: text('source').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.assetId, t.priceDate] }) }))

export const fxRates = pgTable('fxRates', {
  fromCurrency: text('fromCurrency').notNull(),
  toCurrency: text('toCurrency').notNull(),
  rateDate: date('rateDate').notNull(),
  rate: numeric('rate', { precision: 24, scale: 10 }).notNull(),
  source: text('source').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.fromCurrency, t.toCurrency, t.rateDate] }) }))

export const snapshotItems = pgTable('snapshotItems', {
  snapshotDate: date('snapshotDate').notNull(),
  assetId: uuid('assetId').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  accountId: uuid('accountId').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  quantity: numeric('quantity', { precision: 24, scale: 8 }).notNull(),
  price: numeric('price', { precision: 24, scale: 8 }).notNull(),
  fxRate: numeric('fxRate', { precision: 24, scale: 10 }).notNull(),
  valueInBase: numeric('valueInBase', { precision: 24, scale: 8 }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.snapshotDate, t.assetId, t.accountId] }) }))
