import { eq, and, gte, lte } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { fxRates } from '../../db/schema'

export class FxRatesRepository {
  constructor(private db: DrizzleDB) {}

  findAll(filters: { from?: string; to?: string; fromDate?: string; toDate?: string }) {
    const conditions = [
      filters.from ? eq(fxRates.fromCurrency, filters.from) : undefined,
      filters.to ? eq(fxRates.toCurrency, filters.to) : undefined,
      filters.fromDate ? gte(fxRates.rateDate, filters.fromDate) : undefined,
      filters.toDate ? lte(fxRates.rateDate, filters.toDate) : undefined,
    ].filter(Boolean) as Parameters<typeof and>
    return this.db.select().from(fxRates).$dynamic().where(and(...conditions))
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
