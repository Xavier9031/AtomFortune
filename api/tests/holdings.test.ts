import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import app from '../src/index'
import { cleanDb, closeDb, testDb } from './helpers/db'
import { accounts, assets } from '../src/db/schema'

beforeEach(() => cleanDb())
afterAll(() => closeDb())

const seedAssetAndAccount = async () => {
  const [asset] = await testDb.insert(assets).values({
    name: 'BTC', assetClass: 'asset', category: 'investment',
    subKind: 'crypto', currencyCode: 'USD', pricingMode: 'market',
  }).returning()
  const [account] = await testDb.insert(accounts).values({ name: 'Binance', accountType: 'crypto_exchange' }).returning()
  return { asset, account }
}

describe('PUT /api/v1/holdings/:assetId/:accountId', () => {
  it('upserts holding and returns 200', async () => {
    const { asset, account } = await seedAssetAndAccount()
    const res = await app.request(`/api/v1/holdings/${asset.id}/${account.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 0.5 }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).quantity).toBe('0.50000000')
  })

  it('returns 404 if asset does not exist', async () => {
    const [account] = await testDb.insert(accounts).values({ name: 'X', accountType: 'bank' }).returning()
    const res = await app.request(`/api/v1/holdings/00000000-0000-0000-0000-000000000000/${account.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 1 }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 422 if quantity is negative', async () => {
    const { asset, account } = await seedAssetAndAccount()
    const res = await app.request(`/api/v1/holdings/${asset.id}/${account.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: -1 }),
    })
    expect(res.status).toBe(422)
  })
})

describe('GET /api/v1/holdings', () => {
  it('returns holdings with joined asset and account fields', async () => {
    const { asset, account } = await seedAssetAndAccount()
    await app.request(`/api/v1/holdings/${asset.id}/${account.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 2 }),
    })
    const res = await app.request('/api/v1/holdings')
    expect(res.status).toBe(200)
    const list = await res.json()
    expect(list[0].assetName).toBe('BTC')
    expect(list[0].accountName).toBe('Binance')
    expect(list[0].latestValueInBase).toBeNull()
  })
})

describe('DELETE /api/v1/holdings/:assetId/:accountId', () => {
  it('deletes a holding and returns 204', async () => {
    const { asset, account } = await seedAssetAndAccount()
    await app.request(`/api/v1/holdings/${asset.id}/${account.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 1 }),
    })
    const res = await app.request(`/api/v1/holdings/${asset.id}/${account.id}`, { method: 'DELETE' })
    expect(res.status).toBe(204)
  })
})
