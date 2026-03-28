import { eq, and, sql, asc } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { holdings, assets, accounts, snapshotItems } from '../../db/schema'

export class HoldingsRepository {
  constructor(private db: DrizzleDB) {}

  async findAll(userId: string, accountId?: string) {
    const query = this.db
      .select({
        assetId: holdings.assetId,
        accountId: holdings.accountId,
        quantity: holdings.quantity,
        assetName: assets.name,
        assetClass: assets.assetClass,
        category: assets.category,
        subKind: assets.subKind,
        symbol: assets.symbol,
        currencyCode: assets.currencyCode,
        pricingMode: assets.pricingMode,
        unit: assets.unit,
        accountName: accounts.name,
        accountType: accounts.accountType,
        institution: accounts.institution,
        updatedAt: holdings.updatedAt,
        latestValueInBase: sql<string | null>`(
          SELECT si.valueInBase FROM snapshotItems si
          WHERE si.assetId = ${holdings.assetId} AND si.accountId = ${holdings.accountId}
          ORDER BY si.snapshotDate DESC LIMIT 1
        )`,
      })
      .from(holdings)
      .innerJoin(assets, eq(holdings.assetId, assets.id))
      .innerJoin(accounts, eq(holdings.accountId, accounts.id))

    const order = [asc(assets.category), asc(assets.subKind), asc(assets.name)]
    if (accountId) {
      return query.where(and(eq(holdings.userId, userId), eq(holdings.accountId, accountId))).orderBy(...order)
    }
    return query.where(eq(holdings.userId, userId)).orderBy(...order)
  }

  findOne(userId: string, assetId: string, accountId: string) {
    return this.db.select().from(holdings)
      .where(and(
        eq(holdings.assetId, assetId),
        eq(holdings.accountId, accountId),
        eq(holdings.userId, userId),
      ))
      .then(r => r[0] ?? null)
  }

  upsert(userId: string, assetId: string, accountId: string, quantity: string) {
    return this.db.insert(holdings)
      .values({ userId, assetId, accountId, quantity })
      .onConflictDoUpdate({
        target: [holdings.assetId, holdings.accountId],
        set: { quantity, updatedAt: new Date().toISOString() },
      })
      .returning().then(r => r[0])
  }

  delete(userId: string, assetId: string, accountId: string) {
    return this.db.delete(holdings)
      .where(and(
        eq(holdings.assetId, assetId),
        eq(holdings.accountId, accountId),
        eq(holdings.userId, userId),
      ))
      .returning().then(r => r[0] ?? null)
  }
}
