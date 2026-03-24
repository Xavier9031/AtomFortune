import { eq, and, sql } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { accounts, holdings } from '../../db/schema'

export class AccountsRepository {
  constructor(private db: DrizzleDB) {}

  findAll(userId: string) {
    return this.db.select({
      id: accounts.id,
      name: accounts.name,
      institution: accounts.institution,
      accountType: accounts.accountType,
      note: accounts.note,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
      balance: sql<string | null>`(
        SELECT h.quantity FROM holdings h
        JOIN assets a ON h."assetId" = a.id
        WHERE h."accountId" = ${accounts.id}
        AND a."subKind" IN ('bank_account', 'physical_cash', 'e_wallet')
        LIMIT 1
      )`,
    }).from(accounts).where(eq(accounts.userId, userId))
  }

  findById(id: string, userId: string) {
    return this.db.select().from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .then(r => r[0] ?? null)
  }

  create(data: typeof accounts.$inferInsert) {
    return this.db.insert(accounts).values(data).returning().then(r => r[0])
  }

  update(id: string, userId: string, data: Partial<typeof accounts.$inferInsert>) {
    return this.db.update(accounts).set({ ...data, updatedAt: new Date().toISOString() })
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .returning().then(r => r[0] ?? null)
  }

  delete(id: string, userId: string) {
    return this.db.delete(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .returning().then(r => r[0] ?? null)
  }

  hasHoldings(accountId: string) {
    return this.db.select().from(holdings).where(eq(holdings.accountId, accountId))
      .limit(1).then(r => r.length > 0)
  }
}
