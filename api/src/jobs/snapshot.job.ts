import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { assets, holdings, prices, fxRates, snapshotItems, users } from '../db/schema'
import { fetchMarketPrices, fetchHistoricalPricesForAssets } from './pricing.service'
import { fetchFxRates } from './fx.service'
import type { DrizzleDB } from '../db/client'

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function getMarketAssets(db: DrizzleDB) {
  return db.select({ id: assets.id, name: assets.name, symbol: assets.symbol, pricingMode: assets.pricingMode, subKind: assets.subKind, market: assets.market })
    .from(assets).where(eq(assets.pricingMode, 'market'))
}

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

async function getAllUsers(db: DrizzleDB) {
  return db.select({ id: users.id }).from(users)
}

// Precious metal prices are quoted per troy ounce; convert grams to oz for value calc
function getUnitMultiplier(subKind: string | null, unit: string | null): number {
  if (subKind === 'precious_metal' && (unit === 'gram' || unit === '公克')) return 1 / 31.1035
  return 1
}

export async function resolvePrice(
  tx: DrizzleDB, assetId: string, pricingMode: string, today: string
): Promise<number | null> {
  if (pricingMode === 'fixed') return 1.0
  // manual: carry the most recent price ever set (no time cutoff)
  // market: only use prices from the last 30 days (stale quotes are misleading)
  const cutoff = pricingMode === 'manual'
    ? '2000-01-01'
    : formatDate(new Date(new Date(today + 'T00:00:00Z').getTime() - 30 * 86400_000))
  const rows = await tx
    .select({ price: prices.price, priceDate: prices.priceDate })
    .from(prices)
    .where(and(eq(prices.assetId, assetId), gte(prices.priceDate, cutoff), lte(prices.priceDate, today)))
    .orderBy(desc(prices.priceDate))
    .limit(1)
  return rows.length ? Number(rows[0].price) : null
}

export async function resolveFxRate(
  tx: DrizzleDB, currencyCode: string, today: string, maxLookbackDays = 90
): Promise<number> {
  if (currencyCode === 'TWD') return 1.0
  // First try: look back up to maxLookbackDays
  const cutoff = formatDate(new Date(new Date(today + 'T00:00:00Z').getTime() - maxLookbackDays * 86400_000))
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
  if (rows.length) return Number(rows[0].rate)
  // Fallback: use the most recent rate regardless of date (better than 1.0)
  const fallback = await tx
    .select({ rate: fxRates.rate })
    .from(fxRates)
    .where(and(
      eq(fxRates.fromCurrency, currencyCode),
      eq(fxRates.toCurrency, 'TWD'),
      lte(fxRates.rateDate, today),
    ))
    .orderBy(desc(fxRates.rateDate))
    .limit(1)
  if (fallback.length) {
    console.warn(`[fxRate] Using stale rate for ${currencyCode}/TWD (latest: ${fallback[0].rate})`)
    return Number(fallback[0].rate)
  }
  console.warn(`[fxRate] No rate found for ${currencyCode}/TWD, defaulting to 1.0`)
  return 1.0
}

async function upsertPrices(db: DrizzleDB, pricesMap: Map<string, number>, today: string) {
  for (const [assetId, price] of pricesMap) {
    await db.insert(prices)
      .values({ assetId, priceDate: today, price: String(price), source: 'yahoo-finance2' })
      .onConflictDoUpdate({ target: [prices.assetId, prices.priceDate],
                            set: { price: String(price), source: 'yahoo-finance2', updatedAt: new Date().toISOString() } })
  }
}

async function upsertFxRates(db: DrizzleDB, rates: Awaited<ReturnType<typeof fetchFxRates>>, today: string) {
  for (const r of rates) {
    await db.insert(fxRates)
      .values({ fromCurrency: r.fromCurrency, toCurrency: r.toCurrency,
                rateDate: today, rate: String(r.rate), source: r.source })
      .onConflictDoUpdate({ target: [fxRates.fromCurrency, fxRates.toCurrency, fxRates.rateDate],
                            set: { rate: String(r.rate), source: r.source, updatedAt: new Date().toISOString() } })
  }
}

export async function refreshFxRates(db: DrizzleDB) {
  const today = new Date().toISOString().slice(0, 10)
  const rates = await fetchFxRates()
  await upsertFxRates(db, rates, today)
  return rates
}

export type SnapshotJobResult = {
  date: string
  prices: Array<{ assetId: string; name: string; symbol: string; price: number | null; status: 'ok' | 'failed' }>
  fxStatus: 'ok' | 'failed'
  snapshotItemsWritten: number
}

export async function backfillHistoricalPrices(db: DrizzleDB, fromDate: string, toDate: string) {
  const marketAssets = await getMarketAssets(db)
  const historicalData = await fetchHistoricalPricesForAssets(marketAssets, fromDate, toDate)
  let total = 0
  const byAsset: { assetId: string; symbol: string; count: number }[] = []
  for (const [assetId, pricesByDate] of historicalData) {
    let count = 0
    for (const [date, price] of pricesByDate) {
      await db.insert(prices)
        .values({ assetId, priceDate: date, price: String(price), source: 'yahoo-finance2-historical' })
        .onConflictDoNothing()
      count++
    }
    total += count
    const asset = marketAssets.find(a => a.id === assetId)
    byAsset.push({ assetId, symbol: asset?.symbol ?? '', count })
  }
  return { total, byAsset }
}

export async function dailySnapshotJob(
  db: DrizzleDB,
  snapshotDate = new Date(),
  options: { fxLookbackDays?: number; skipPriceFetch?: boolean } = {}
): Promise<SnapshotJobResult> {
  const today = formatDate(snapshotDate)

  const marketAssets = await getMarketAssets(db)
  let pricesMap = new Map<string, number>()
  if (!options.skipPriceFetch) {
    try {
      pricesMap = await fetchMarketPrices(marketAssets)
      await upsertPrices(db, pricesMap, today)
    } catch (err) {
      console.warn('Market price fetch failed:', err)
    }
  }

  const priceResults = marketAssets.map(a => ({
    assetId: a.id,
    name: a.name,
    symbol: a.symbol ?? '',
    price: pricesMap.get(a.id) ?? null,
    status: (pricesMap.has(a.id) ? 'ok' : 'failed') as 'ok' | 'failed',
  }))

  let fxStatus: 'ok' | 'failed' = 'failed'
  if (!options.skipPriceFetch) {
    try {
      const rates = await fetchFxRates()
      await upsertFxRates(db, rates, today)
      fxStatus = 'ok'
    } catch (err) {
      console.warn('FX rate refresh failed:', err)
    }
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
      const fxRate = await resolveFxRate(db, h.currencyCode, today, options.fxLookbackDays ?? 7)
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
