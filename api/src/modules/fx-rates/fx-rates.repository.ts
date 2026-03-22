import { eq, and, gte, lte } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { fxRates } from '../../db/schema'

export class FxRatesRepository {
  constructor(private db: DrizzleDB) {}

  findAll(filters: { from?: string; to?: string; fromDate?: string; toDate?: string }) {
    let query = this.db.select().from(fxRates).$dynamic()
    if (filters.from) query = query.where(eq(fxRates.fromCurrency, filters.from))
    if (filters.to) query = query.where(eq(fxRates.toCurrency, filters.to))
    if (filters.fromDate) query = query.where(gte(fxRates.rateDate, filters.fromDate))
    if (filters.toDate) query = query.where(lte(fxRates.rateDate, filters.toDate))
    return query
  }

  upsert(from: string, to: string, rateDate: string, rate: string, source: string) {
    return this.db.insert(fxRates)
      .values({ fromCurrency: from, toCurrency: to, rateDate, rate, source })
      .onConflictDoUpdate({
        target: [fxRates.fromCurrency, fxRates.toCurrency, fxRates.rateDate],
        set: { rate, source, updatedAt: new Date() },
      })
      .returning().then(r => r[0])
  }
}
