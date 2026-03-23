import { eq, and, sql } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { holdings, assets, accounts, snapshotItems } from '../../db/schema'

export class HoldingsRepository {
  constructor(private db: DrizzleDB) {}

  async findAll(accountId?: string) {
    const query = this.db
      .select({
        assetId: holdings.assetId,
        accountId: holdings.accountId,
        quantity: holdings.quantity,
        assetName: assets.name,
        assetClass: assets.assetClass,
        category: assets.category,
        subKind: assets.subKind,
        currencyCode: assets.currencyCode,
        pricingMode: assets.pricingMode,
        unit: assets.unit,
        accountName: accounts.name,
        accountType: accounts.accountType,
        institution: accounts.institution,
        updatedAt: holdings.updatedAt,
        latestValueInBase: sql<string | null>`(
          SELECT si."valueInBase" FROM "snapshotItems" si
          WHERE si."assetId" = ${holdings.assetId} AND si."accountId" = ${holdings.accountId}
          ORDER BY si."snapshotDate" DESC LIMIT 1
        )`,
      })
      .from(holdings)
      .innerJoin(assets, eq(holdings.assetId, assets.id))
      .innerJoin(accounts, eq(holdings.accountId, accounts.id))

    if (accountId) return query.where(eq(holdings.accountId, accountId))
    return query
  }

  findOne(assetId: string, accountId: string) {
    return this.db.select().from(holdings)
      .where(and(eq(holdings.assetId, assetId), eq(holdings.accountId, accountId)))
      .then(r => r[0] ?? null)
  }

  upsert(assetId: string, accountId: string, quantity: string) {
    return this.db.insert(holdings)
      .values({ assetId, accountId, quantity })
      .onConflictDoUpdate({
        target: [holdings.assetId, holdings.accountId],
        set: { quantity, updatedAt: new Date() },
      })
      .returning().then(r => r[0])
  }

  delete(assetId: string, accountId: string) {
    return this.db.delete(holdings)
      .where(and(eq(holdings.assetId, assetId), eq(holdings.accountId, accountId)))
      .returning().then(r => r[0] ?? null)
  }
}
