import { eq, gte, lte, desc } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { transactions } from '../../db/schema'

export class TransactionsRepository {
  constructor(private db: DrizzleDB) {}

  findAll(filters: { assetId?: string; accountId?: string; from?: string; to?: string }) {
    let query = this.db.select().from(transactions).$dynamic()
    if (filters.assetId) query = query.where(eq(transactions.assetId, filters.assetId))
    if (filters.accountId) query = query.where(eq(transactions.accountId, filters.accountId))
    if (filters.from) query = query.where(gte(transactions.txnDate, filters.from))
    if (filters.to) query = query.where(lte(transactions.txnDate, filters.to))
    return query.orderBy(desc(transactions.txnDate))
  }

  findById(id: string) {
    return this.db.select().from(transactions).where(eq(transactions.id, id)).then(r => r[0] ?? null)
  }

  create(data: typeof transactions.$inferInsert) {
    return this.db.insert(transactions).values(data).returning().then(r => r[0])
  }

  updateNote(id: string, note: string | null) {
    return this.db.update(transactions).set({ note, updatedAt: new Date() })
      .where(eq(transactions.id, id)).returning().then(r => r[0] ?? null)
  }

  delete(id: string) {
    return this.db.delete(transactions).where(eq(transactions.id, id)).returning().then(r => r[0] ?? null)
  }
}
