import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { assets, holdings, prices, fxRates, snapshotItems } from '../db/schema'
import { fetchMarketPrices } from './pricing.service'
import { fetchFxRates } from './fx.service'
import type { DrizzleDB } from '../db/client'

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function getMarketAssets(db: DrizzleDB) {
  return db.select({ id: assets.id, name: assets.name, symbol: assets.symbol, pricingMode: assets.pricingMode, subKind: assets.subKind })
    .from(assets).where(eq(assets.pricingMode, 'market'))
}

export async function getAllHoldingsWithAssets(tx: DrizzleDB) {
  return tx
    .select({
      assetId: holdings.assetId, accountId: holdings.accountId,
      quantity: holdings.quantity, pricingMode: assets.pricingMode,
      currencyCode: assets.currencyCode, subKind: assets.subKind, unit: assets.unit,
    })
    .from(holdings)
    .innerJoin(assets, eq(holdings.assetId, assets.id))
}

// Precious metal prices are quoted per troy ounce; convert grams to oz for value calc
function getUnitMultiplier(subKind: string | null, unit: string | null): number {
  if (subKind === 'precious_metal' && unit === '公克') return 1 / 31.1035
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
    : formatDate(new Date(Date.now() - 30 * 86400_000))
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
  return rows.length ? Number(rows[0].rate) : 1.0
}

async function upsertPrices(db: DrizzleDB, pricesMap: Map<string, number>, today: string) {
  for (const [assetId, price] of pricesMap) {
    await db.insert(prices)
      .values({ assetId, priceDate: today, price: String(price), source: 'yahoo-finance2' })
      .onConflictDoUpdate({ target: [prices.assetId, prices.priceDate],
                            set: { price: String(price), source: 'yahoo-finance2', updatedAt: new Date() } })
  }
}

async function upsertFxRates(db: DrizzleDB, rates: Awaited<ReturnType<typeof fetchFxRates>>, today: string) {
  for (const r of rates) {
    await db.insert(fxRates)
      .values({ fromCurrency: r.fromCurrency, toCurrency: r.toCurrency,
                rateDate: today, rate: String(r.rate), source: r.source })
      .onConflictDoUpdate({ target: [fxRates.fromCurrency, fxRates.toCurrency, fxRates.rateDate],
                            set: { rate: String(r.rate), source: r.source, updatedAt: new Date() } })
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

export async function dailySnapshotJob(db: DrizzleDB, snapshotDate = new Date()): Promise<SnapshotJobResult> {
  const today = formatDate(snapshotDate)

  const marketAssets = await getMarketAssets(db)
  let pricesMap = new Map<string, number>()
  try {
    pricesMap = await fetchMarketPrices(marketAssets)
    await upsertPrices(db, pricesMap, today)
  } catch (err) {
    console.warn('Market price fetch failed:', err)
  }

  const priceResults = marketAssets.map(a => ({
    assetId: a.id,
    name: a.name,
    symbol: a.symbol ?? '',
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
  await db.transaction(async (tx) => {
    await tx.delete(snapshotItems).where(eq(snapshotItems.snapshotDate, today))

    const holdingRows = await getAllHoldingsWithAssets(tx)
    const missingAssets: string[] = []

    for (const h of holdingRows) {
      const price = await resolvePrice(tx, h.assetId, h.pricingMode, today)
      if (price === null) { missingAssets.push(h.assetId); continue }

      const fxRate = await resolveFxRate(tx, h.currencyCode, today)
      const unitMultiplier = getUnitMultiplier(h.subKind, h.unit)
      const valueInBase = Number(h.quantity) * unitMultiplier * price * fxRate

      await tx.insert(snapshotItems).values({
        snapshotDate: today, assetId: h.assetId, accountId: h.accountId,
        quantity: h.quantity, price: String(price), fxRate: String(fxRate),
        valueInBase: String(valueInBase),
      })
      snapshotItemsWritten++
    }

    if (missingAssets.length) console.warn('Missing assets:', missingAssets)
  })

  return { date: today, prices: priceResults, fxStatus, snapshotItemsWritten }
}
