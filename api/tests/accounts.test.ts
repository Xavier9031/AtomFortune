import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import app from '../src/index'
import { cleanDb, closeDb, testDb, seedTestUser } from './helpers/db'
import { accounts, assets, holdings } from '../src/db/schema'

beforeEach(async () => { cleanDb(); await seedTestUser() })
afterAll(() => closeDb())

describe('POST /api/v1/accounts', () => {
  it('creates an account and returns 201', async () => {
    const res = await app.request('/api/v1/accounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '富途證券', institution: 'Futu', accountType: 'broker', note: null }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBeDefined()
    expect(body.name).toBe('富途證券')
  })
})

describe('DELETE /api/v1/accounts/:id', () => {
  it('returns 409 if account has holdings', async () => {
    const [account] = await testDb.insert(accounts).values({ name: 'TestBank', accountType: 'bank', userId: 'default-user' }).returning()
    const [asset] = await testDb.insert(assets).values({
      name: 'Cash', assetClass: 'asset', category: 'liquid',
      subKind: 'bank_account', currencyCode: 'TWD', pricingMode: 'fixed', userId: 'default-user',
    }).returning()
    await testDb.insert(holdings).values({ assetId: asset.id, accountId: account.id, quantity: '1000', userId: 'default-user' })

    const res = await app.request(`/api/v1/accounts/${account.id}`, { method: 'DELETE' })
    expect(res.status).toBe(409)
  })

  it('deletes account with no holdings and returns 204', async () => {
    const [account] = await testDb.insert(accounts).values({ name: 'Empty', accountType: 'cash', userId: 'default-user' }).returning()
    const res = await app.request(`/api/v1/accounts/${account.id}`, { method: 'DELETE' })
    expect(res.status).toBe(204)
  })
})
