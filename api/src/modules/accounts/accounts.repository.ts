import { eq } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { accounts, holdings } from '../../db/schema'

export class AccountsRepository {
  constructor(private db: DrizzleDB) {}

  findAll() { return this.db.select().from(accounts) }
  findById(id: string) {
    return this.db.select().from(accounts).where(eq(accounts.id, id)).then(r => r[0] ?? null)
  }
  create(data: typeof accounts.$inferInsert) {
    return this.db.insert(accounts).values(data).returning().then(r => r[0])
  }
  update(id: string, data: Partial<typeof accounts.$inferInsert>) {
    return this.db.update(accounts).set({ ...data, updatedAt: new Date() })
      .where(eq(accounts.id, id)).returning().then(r => r[0] ?? null)
  }
  delete(id: string) {
    return this.db.delete(accounts).where(eq(accounts.id, id)).returning().then(r => r[0] ?? null)
  }
  hasHoldings(accountId: string) {
    return this.db.select().from(holdings).where(eq(holdings.accountId, accountId))
      .limit(1).then(r => r.length > 0)
  }
}
