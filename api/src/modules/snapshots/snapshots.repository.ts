import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { assets, accounts, snapshotItems } from '../../db/schema'
import type { DrizzleDB } from '../../db/client'

type RangeParam = '30d' | '1y' | 'all'

function rangeToDate(range: RangeParam): string | null {
  if (range === '30d') return new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
  if (range === '1y')  return new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10)
  return null
}

export async function getSnapshotHistory(db: DrizzleDB, userId: string, range: RangeParam) {
  const cutoff = rangeToDate(range)
  const userFilter = eq(snapshotItems.userId, userId)
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
    ? base.where(and(userFilter, gte(snapshotItems.snapshotDate, cutoff)))
    : base.where(userFilter)
}

export async function getSnapshotItemsByAsset(db: DrizzleDB, userId: string, assetId: string, range: RangeParam) {
  const cutoff = rangeToDate(range)
  const condition = cutoff
    ? and(eq(snapshotItems.userId, userId), eq(snapshotItems.assetId, assetId), gte(snapshotItems.snapshotDate, cutoff))
    : and(eq(snapshotItems.userId, userId), eq(snapshotItems.assetId, assetId))

  return db
    .select({
      snapshotDate: snapshotItems.snapshotDate,
      valueInBase: sql<string>`SUM(${snapshotItems.valueInBase})`.as('valueInBase'),
    })
    .from(snapshotItems)
    .where(condition)
    .groupBy(snapshotItems.snapshotDate)
    .orderBy(desc(snapshotItems.snapshotDate))
}

export async function getSnapshotByDate(db: DrizzleDB, userId: string, date: string) {
  const rows = await db
    .select({
      snapshotDate: snapshotItems.snapshotDate,
      assetId: snapshotItems.assetId, accountId: snapshotItems.accountId,
      assetName: assets.name, accountName: accounts.name,
      assetClass: assets.assetClass, category: assets.category,
      quantity: snapshotItems.quantity, price: snapshotItems.price,
      currencyCode: assets.currencyCode, unit: assets.unit,
      fxRate: snapshotItems.fxRate, valueInBase: snapshotItems.valueInBase,
    })
    .from(snapshotItems)
    .innerJoin(assets, eq(snapshotItems.assetId, assets.id))
    .innerJoin(accounts, eq(snapshotItems.accountId, accounts.id))
    .where(and(eq(snapshotItems.userId, userId), eq(snapshotItems.snapshotDate, date)))

  if (!rows.length) return null

  const netWorth = rows.reduce((sum, r) => {
    const v = Number(r.valueInBase)
    return sum + (r.assetClass === 'liability' ? -v : v)
  }, 0)

  return { snapshotDate: date, netWorth, items: rows }
}
