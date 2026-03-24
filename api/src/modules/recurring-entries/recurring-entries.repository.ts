import { eq, and } from 'drizzle-orm'
import { recurringEntries } from '../../db/schema'
import type { DrizzleDB } from '../../db/client'

export class RecurringEntriesRepository {
  constructor(private db: DrizzleDB) {}

  async findAll({ assetId, accountId }: { assetId?: string; accountId?: string } = {}) {
    if (assetId && accountId) {
      return this.db.select().from(recurringEntries)
        .where(and(eq(recurringEntries.assetId, assetId), eq(recurringEntries.accountId, accountId)))
    } else if (assetId) {
      return this.db.select().from(recurringEntries)
        .where(eq(recurringEntries.assetId, assetId))
    } else if (accountId) {
      return this.db.select().from(recurringEntries)
        .where(eq(recurringEntries.accountId, accountId))
    }
    return this.db.select().from(recurringEntries)
  }

  async create(data: {
    assetId?: string; accountId?: string
    type: string; amount: number; currencyCode: string
    dayOfMonth: number; label?: string
    effectiveFrom: string; effectiveTo?: string
  }) {
    const [row] = await this.db.insert(recurringEntries).values({
      assetId: data.assetId,
      accountId: data.accountId,
      type: data.type,
      amount: String(data.amount),
      currencyCode: data.currencyCode,
      dayOfMonth: data.dayOfMonth,
      label: data.label,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo,
    }).returning()
    return row
  }

  async update(id: string, data: Partial<{
    type: string; amount: number; currencyCode: string
    dayOfMonth: number; label: string | null
    effectiveFrom: string; effectiveTo: string | null
  }>) {
    const set: Record<string, unknown> = { updatedAt: new Date() }
    if (data.type !== undefined) set.type = data.type
    if (data.amount !== undefined) set.amount = String(data.amount)
    if (data.currencyCode !== undefined) set.currencyCode = data.currencyCode
    if (data.dayOfMonth !== undefined) set.dayOfMonth = data.dayOfMonth
    if ('label' in data) set.label = data.label
    if (data.effectiveFrom !== undefined) set.effectiveFrom = data.effectiveFrom
    if ('effectiveTo' in data) set.effectiveTo = data.effectiveTo

    const [row] = await this.db.update(recurringEntries)
      .set(set as any)
      .where(eq(recurringEntries.id, id))
      .returning()
    return row
  }

  async delete(id: string) {
    await this.db.delete(recurringEntries).where(eq(recurringEntries.id, id))
  }
}
