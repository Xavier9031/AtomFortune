import { eq, gte, lte } from 'drizzle-orm'
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
