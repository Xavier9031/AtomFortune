import { eq, and } from 'drizzle-orm'
import { recurringEntries, holdings, transactions } from '../db/schema'
import type { DrizzleDB } from '../db/client'

function parseYM(ym: string): { year: number; month: number } {
  const [y, m] = ym.split('-').map(Number)
  return { year: y, month: m }
}

function toYM(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function monthRange(from: string, to: string): string[] {
  const start = parseYM(from)
  const end = parseYM(to)
  const months: string[] = []
  let y = start.year, m = start.month
  while (y < end.year || (y === end.year && m <= end.month)) {
    months.push(toYM(y, m))
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

function nextMonth(ym: string): string {
  const { year, month } = parseYM(ym)
  return month === 12 ? toYM(year + 1, 1) : toYM(year, month + 1)
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export async function applyRecurringEntries(
  db: DrizzleDB, today: string
): Promise<{ applied: number }> {
  const todayYM = today.slice(0, 7)
  const allEntries = await db.select().from(recurringEntries)
  let applied = 0

  for (const entry of allEntries) {
    if (!entry.assetId || !entry.accountId) continue
    if (!entry.quantity) continue

    const startYM = entry.lastAppliedDate
      ? nextMonth(entry.lastAppliedDate)
      : entry.effectiveFrom
    const endYM = entry.effectiveTo && entry.effectiveTo < todayYM
      ? entry.effectiveTo
      : todayYM

    if (startYM > endYM) continue

    const months = monthRange(startYM, endYM)
    if (months.length === 0) continue

    for (const ym of months) {
      const { year, month } = parseYM(ym)
      const day = Math.min(entry.dayOfMonth, daysInMonth(year, month))
      const txnDate = `${ym}-${String(day).padStart(2, '0')}`

      await db.insert(transactions).values({
        userId: entry.userId,
        assetId: entry.assetId,
        accountId: entry.accountId,
        txnType: entry.type,
        quantity: entry.quantity!,
        txnDate,
        note: entry.label ? `[auto] ${entry.label}` : '[auto]',
      })

      // IMPORTANT: query holding by BOTH assetId AND accountId (composite PK)
      const [existing] = await db.select({ quantity: holdings.quantity })
        .from(holdings)
        .where(and(eq(holdings.assetId, entry.assetId), eq(holdings.accountId, entry.accountId)))
      if (existing) {
        const newQty = Number(existing.quantity) + Number(entry.quantity!)
        await db.update(holdings)
          .set({ quantity: String(newQty), updatedAt: new Date().toISOString() })
          .where(and(eq(holdings.assetId, entry.assetId), eq(holdings.accountId, entry.accountId)))
      }

      applied++
    }

    await db.update(recurringEntries)
      .set({ lastAppliedDate: months[months.length - 1], updatedAt: new Date().toISOString() })
      .where(eq(recurringEntries.id, entry.id))
  }

  if (applied > 0) console.log(`[recurring] Applied ${applied} recurring entries`)
  return { applied }
}
