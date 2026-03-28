import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, cleanDb, seedTestUser } from './helpers/db'
import { assets, accounts, holdings, transactions, recurringEntries } from '../src/db/schema'
import { applyRecurringEntries } from '../src/jobs/recurring.job'
import { eq } from 'drizzle-orm'

describe('applyRecurringEntries', () => {
  let userId: string

  beforeEach(async () => {
    cleanDb()
    const user = await seedTestUser('recurring-test')
    userId = user.id

    await testDb.insert(assets).values({
      id: 'asset-1', userId, name: 'Salary Account', assetClass: 'asset',
      category: 'liquid', subKind: 'bank_account', currencyCode: 'TWD', pricingMode: 'fixed',
    })
    await testDb.insert(accounts).values({
      id: 'acct-1', userId, name: 'Bank', accountType: 'bank',
    })
    await testDb.insert(holdings).values({
      assetId: 'asset-1', accountId: 'acct-1', userId, quantity: '100000',
    })
  })

  it('applies missed months and creates transactions', async () => {
    await testDb.insert(recurringEntries).values({
      userId, assetId: 'asset-1', accountId: 'acct-1',
      type: 'income', amount: '50000', quantity: '50000',
      currencyCode: 'TWD', dayOfMonth: 25,
      effectiveFrom: '2026-01',
    })

    const result = await applyRecurringEntries(testDb, '2026-03-28')
    expect(result.applied).toBe(3)

    const txns = await testDb.select().from(transactions).where(eq(transactions.userId, userId))
    expect(txns).toHaveLength(3)
    expect(txns.map(t => t.txnDate).sort()).toEqual(['2026-01-25', '2026-02-25', '2026-03-25'])

    const [h] = await testDb.select().from(holdings).where(eq(holdings.userId, userId))
    expect(Number(h.quantity)).toBe(250000)
  })

  it('does not re-apply already applied months', async () => {
    await testDb.insert(recurringEntries).values({
      userId, assetId: 'asset-1', accountId: 'acct-1',
      type: 'income', amount: '50000', quantity: '50000',
      currencyCode: 'TWD', dayOfMonth: 15,
      effectiveFrom: '2026-01', lastAppliedDate: '2026-02',
    })

    const result = await applyRecurringEntries(testDb, '2026-03-28')
    expect(result.applied).toBe(1)

    const txns = await testDb.select().from(transactions).where(eq(transactions.userId, userId))
    expect(txns).toHaveLength(1)
    expect(txns[0].txnDate).toBe('2026-03-15')
  })

  it('respects effectiveTo end date', async () => {
    await testDb.insert(recurringEntries).values({
      userId, assetId: 'asset-1', accountId: 'acct-1',
      type: 'expense', amount: '10000', quantity: '-10000',
      currencyCode: 'TWD', dayOfMonth: 1,
      effectiveFrom: '2026-01', effectiveTo: '2026-02',
    })

    const result = await applyRecurringEntries(testDb, '2026-06-01')
    expect(result.applied).toBe(2)

    const [h] = await testDb.select().from(holdings).where(eq(holdings.userId, userId))
    expect(Number(h.quantity)).toBe(80000)
  })

  it('handles entry with no assetId/accountId (skip gracefully)', async () => {
    await testDb.insert(recurringEntries).values({
      userId, type: 'income', amount: '5000',
      currencyCode: 'TWD', dayOfMonth: 1,
      effectiveFrom: '2026-01',
    })

    const result = await applyRecurringEntries(testDb, '2026-03-01')
    expect(result.applied).toBe(0)
  })

  it('does nothing when no recurring entries exist', async () => {
    const result = await applyRecurringEntries(testDb, '2026-03-28')
    expect(result.applied).toBe(0)
  })
})
