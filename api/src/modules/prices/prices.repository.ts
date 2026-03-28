import { and, eq, gte, lte } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { assets, prices } from '../../db/schema'

export class PricesRepository {
  constructor(private db: DrizzleDB) {}

  findAll(userId: string, filters: { assetId?: string; from?: string; to?: string }) {
    const conditions = [eq(assets.userId, userId)]
    if (filters.assetId) conditions.push(eq(prices.assetId, filters.assetId))
    if (filters.from) conditions.push(gte(prices.priceDate, filters.from))
    if (filters.to) conditions.push(lte(prices.priceDate, filters.to))

    let query = this.db.select({
      assetId: prices.assetId,
      priceDate: prices.priceDate,
      price: prices.price,
      source: prices.source,
      createdAt: prices.createdAt,
      updatedAt: prices.updatedAt,
    })
      .from(prices)
      .innerJoin(assets, eq(prices.assetId, assets.id))
      .where(and(...conditions))
      .$dynamic()
    return query
  }

  upsert(assetId: string, priceDate: string, price: string, source: string) {
    return this.db.insert(prices)
      .values({ assetId, priceDate, price, source })
      .onConflictDoUpdate({
        target: [prices.assetId, prices.priceDate],
        set: { price, source, updatedAt: new Date().toISOString() },
      })
      .returning().then(r => r[0])
  }
}
