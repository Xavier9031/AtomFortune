import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { assets, holdings, prices, fxRates, snapshotItems } from '../db/schema'
import { fetchMarketPrices } from './pricing.service'
import { fetchFxRates } from './fx.service'
import type { DrizzleDB } from '../db/client'

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function getMarketAssets(db: DrizzleDB) {
  return db.select().from(assets).where(eq(assets.pricingMode, 'market'))
}

export async function getAllHoldingsWithAssets(tx: DrizzleDB) {
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
        valueInBase: String(valueInBase),
      })
    }

    if (missingAssets.length) console.warn('Missing assets:', missingAssets)
  })
}
