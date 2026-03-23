import { and, desc, eq, lt, max, sql, gte } from 'drizzle-orm'
import { assets, fxRates, snapshotItems, holdings } from '../../db/schema'
import type { DrizzleDB } from '../../db/client'

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

export async function getLiveHoldings(db: DrizzleDB) {
  return db.select({
    assetId: assets.id,
    name: assets.name,
    assetClass: assets.assetClass,
    category: assets.category,
    currencyCode: assets.currencyCode,
    subKind: assets.subKind,
    unit: assets.unit,
    quantity: holdings.quantity,
    price: sql<string>`COALESCE(
      (SELECT p.price FROM prices p WHERE p."assetId" = ${assets.id}
       ORDER BY p."priceDate" DESC LIMIT 1), '1')`,
    fxToBase: sql<string>`CASE WHEN ${assets.currencyCode} = 'TWD' THEN '1'
      ELSE COALESCE(
        (SELECT fx.rate FROM "fxRates" fx
         WHERE fx."fromCurrency" = ${assets.currencyCode} AND fx."toCurrency" = 'TWD'
         ORDER BY fx."rateDate" DESC LIMIT 1), '1')
      END`,
  })
  .from(holdings)
  .innerJoin(assets, eq(holdings.assetId, assets.id))
}

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
