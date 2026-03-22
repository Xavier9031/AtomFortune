import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import app from '../src/index'
import { cleanDb, closeDb, testDb } from './helpers/db'
import { accounts, assets } from '../src/db/schema'

beforeEach(() => cleanDb())
afterAll(() => closeDb())

const seedAssetAndAccount = async () => {
  const [asset] = await testDb.insert(assets).values({
    name: 'ETH', assetClass: 'asset', category: 'investment',
    subKind: 'crypto', currencyCode: 'USD', pricingMode: 'market',
  }).returning()
  const [account] = await testDb.insert(accounts).values({ name: 'OKX', accountType: 'crypto_exchange' }).returning()
  return { asset, account }
}

describe('POST /api/v1/transactions', () => {
  it('creates a buy transaction (positive quantity)', async () => {
    const { asset, account } = await seedAssetAndAccount()
    const res = await app.request('/api/v1/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: asset.id, accountId: account.id,
        txnType: 'buy', quantity: 1.0, txnDate: '2026-03-20', note: 'test buy' }),
    })
    expect(res.status).toBe(201)
    expect((await res.json()).txnType).toBe('buy')
  })

  it('rejects negative quantity for buy type → 422', async () => {
    const { asset, account } = await seedAssetAndAccount()
    const res = await app.request('/api/v1/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: asset.id, accountId: account.id,
        txnType: 'buy', quantity: -1.0, txnDate: '2026-03-20' }),
    })
    expect(res.status).toBe(422)
  })

  it('allows negative quantity for adjustment type', async () => {
    const { asset, account } = await seedAssetAndAccount()
    const res = await app.request('/api/v1/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: asset.id, accountId: account.id,
        txnType: 'adjustment', quantity: -0.5, txnDate: '2026-03-20' }),
    })
    expect(res.status).toBe(201)
  })
})

describe('PATCH /api/v1/transactions/:id', () => {
  it('updates only note field', async () => {
    const { asset, account } = await seedAssetAndAccount()
    const create = await app.request('/api/v1/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: asset.id, accountId: account.id,
        txnType: 'adjustment', quantity: 1, txnDate: '2026-03-20' }),
    })
    const { id } = await create.json()
    const res = await app.request(`/api/v1/transactions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'corrected note' }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).note).toBe('corrected note')
  })
})

describe('DELETE /api/v1/transactions/:id', () => {
  it('deletes adjustment transaction → 204', async () => {
    const { asset, account } = await seedAssetAndAccount()
    const create = await app.request('/api/v1/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: asset.id, accountId: account.id,
        txnType: 'adjustment', quantity: 1, txnDate: '2026-03-20' }),
    })
    const { id } = await create.json()
    const res = await app.request(`/api/v1/transactions/${id}`, { method: 'DELETE' })
    expect(res.status).toBe(204)
  })

  it('rejects delete of non-adjustment transaction → 422', async () => {
    const { asset, account } = await seedAssetAndAccount()
    const create = await app.request('/api/v1/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: asset.id, accountId: account.id,
        txnType: 'buy', quantity: 1, txnDate: '2026-03-20' }),
    })
    const { id } = await create.json()
    const res = await app.request(`/api/v1/transactions/${id}`, { method: 'DELETE' })
    expect(res.status).toBe(422)
  })
})
