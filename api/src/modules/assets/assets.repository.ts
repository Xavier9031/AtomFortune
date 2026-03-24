import { eq, and } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { assets, holdings } from '../../db/schema'

export class AssetsRepository {
  constructor(private db: DrizzleDB) {}

  findAll() { return this.db.select().from(assets) }

  findById(id: string) {
    return this.db.select().from(assets).where(eq(assets.id, id)).then(r => r[0] ?? null)
  }

  create(data: typeof assets.$inferInsert) {
    return this.db.insert(assets).values(data).returning().then(r => r[0])
  }

  update(id: string, data: Partial<typeof assets.$inferInsert>) {
    return this.db.update(assets).set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(assets.id, id)).returning().then(r => r[0] ?? null)
  }

  delete(id: string) {
    return this.db.delete(assets).where(eq(assets.id, id)).returning().then(r => r[0] ?? null)
  }

  findBySubKindAndCurrency(subKind: string, currencyCode: string) {
    return this.db.select().from(assets)
      .where(and(eq(assets.subKind, subKind), eq(assets.currencyCode, currencyCode)))
      .limit(1)
      .then(r => r[0] ?? null)
  }

  findByAccountAndSubKind(accountId: string, subKind: string, currencyCode?: string) {
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
        eq(assets.subKind, subKind),
        ...(currencyCode ? [eq(assets.currencyCode, currencyCode)] : []),
      ))
      .then(r => r[0] ?? null)
  }
}
