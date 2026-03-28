import { eq, and, asc } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { assets, holdings } from '../../db/schema'

export class AssetsRepository {
  constructor(private db: DrizzleDB) {}

  findAll(userId: string) {
    return this.db.select().from(assets).where(eq(assets.userId, userId))
      .orderBy(asc(assets.category), asc(assets.subKind), asc(assets.name))
  }

  findById(id: string, userId: string) {
    return this.db.select().from(assets)
      .where(and(eq(assets.id, id), eq(assets.userId, userId)))
      .then(r => r[0] ?? null)
  }

  create(data: typeof assets.$inferInsert) {
    return this.db.insert(assets).values(data).returning().then(r => r[0])
  }

  update(id: string, userId: string, data: Partial<typeof assets.$inferInsert>) {
    return this.db.update(assets)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(and(eq(assets.id, id), eq(assets.userId, userId)))
      .returning().then(r => r[0] ?? null)
  }

  delete(id: string, userId: string) {
    return this.db.delete(assets)
      .where(and(eq(assets.id, id), eq(assets.userId, userId)))
      .returning().then(r => r[0] ?? null)
  }

  findBySubKindAndCurrency(userId: string, subKind: string, currencyCode: string) {
    return this.db.select().from(assets)
      .where(and(
        eq(assets.userId, userId),
        eq(assets.subKind, subKind),
        eq(assets.currencyCode, currencyCode),
      ))
      .limit(1)
      .then(r => r[0] ?? null)
  }

  findByAccountAndSubKind(userId: string, accountId: string, subKind: string, currencyCode?: string) {
    return this.db.select({
      id: assets.id, name: assets.name, assetClass: assets.assetClass,
      category: assets.category, subKind: assets.subKind, symbol: assets.symbol,
      market: assets.market, currencyCode: assets.currencyCode, pricingMode: assets.pricingMode,
      unit: assets.unit, createdAt: assets.createdAt, updatedAt: assets.updatedAt,
    })
      .from(assets)
      .innerJoin(holdings, and(eq(holdings.assetId, assets.id), eq(holdings.accountId, accountId)))
      .where(and(
        eq(assets.userId, userId),
        eq(assets.subKind, subKind),
        ...(currencyCode ? [eq(assets.currencyCode, currencyCode)] : []),
      ))
      .then(r => r[0] ?? null)
  }
}
