import { like, or, eq, and, sql } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { tickers } from '../../db/schema'

export class TickersRepository {
  constructor(private db: DrizzleDB) {}

  search(q: string, country?: string) {
    const textCond = or(like(tickers.symbol, `%${q}%`), like(tickers.name, `%${q}%`))!
    const where = country ? and(textCond, eq(tickers.country, country)) : textCond
    return this.db.select().from(tickers).where(where).limit(20)
  }

  count(country: string) {
    return this.db.select({ n: sql<number>`count(*)` })
      .from(tickers).where(eq(tickers.country, country))
      .then(r => Number(r[0]?.n ?? 0))
  }

  upsertMany(rows: (typeof tickers.$inferInsert)[]) {
    if (rows.length === 0) return Promise.resolve()
    return this.db.insert(tickers).values(rows)
      .onConflictDoUpdate({
        target: tickers.symbol,
        set: { name: sql`excluded.name`, updatedAt: sql`CURRENT_TIMESTAMP` },
      })
  }
}
