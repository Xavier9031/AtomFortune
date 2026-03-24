import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import app from '../src/index'
import { cleanDb, closeDb, testDb } from './helpers/db'
import { assets, accounts } from '../src/db/schema'

beforeEach(() => cleanDb())
afterAll(() => closeDb())

describe('DELETE /api/v1/backup/reset', () => {
  it('returns ok:true and deletes all data', async () => {
    await testDb.insert(assets).values({
      name: 'Cash', assetClass: 'asset', category: 'liquid',
      subKind: 'bank_account', currencyCode: 'TWD', pricingMode: 'fixed',
    })
    await testDb.insert(accounts).values({ name: 'My Bank', accountType: 'bank' })

    const res = await app.request('/api/v1/backup/reset', { method: 'DELETE' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    const remaining = await testDb.select().from(assets)
    expect(remaining).toHaveLength(0)
  })
})
