import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import app from '../src/index'
import { cleanDb, closeDb, testDb } from './helpers/db'
import { assets } from '../src/db/schema'

beforeEach(() => cleanDb())
afterAll(() => closeDb())

describe('POST /api/v1/prices/manual', () => {
  it('creates a manual price for a manual-mode asset', async () => {
    const [asset] = await testDb.insert(assets).values({
      name: 'Gold', assetClass: 'asset', category: 'investment',
      subKind: 'precious_metal', currencyCode: 'TWD', pricingMode: 'manual',
    }).returning()

    const res = await app.request('/api/v1/prices/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: asset.id, priceDate: '2026-03-22', price: 7900000 }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(Number(body.price)).toBe(7900000)
    expect(body.source).toBe('manual')
  })

  it('returns 422 for market-mode asset', async () => {
    const [asset] = await testDb.insert(assets).values({
      name: 'AAPL', assetClass: 'asset', category: 'investment',
      subKind: 'stock', currencyCode: 'USD', pricingMode: 'market',
    }).returning()

    const res = await app.request('/api/v1/prices/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: asset.id, priceDate: '2026-03-22', price: 210 }),
    })
    expect(res.status).toBe(422)
  })
})

describe('GET /api/v1/prices', () => {
  it('returns price history for an asset', async () => {
    const [asset] = await testDb.insert(assets).values({
      name: 'Fund A', assetClass: 'asset', category: 'investment',
      subKind: 'fund', currencyCode: 'TWD', pricingMode: 'manual',
    }).returning()
    await app.request('/api/v1/prices/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: asset.id, priceDate: '2026-03-22', price: 10.5 }),
    })
    const res = await app.request(`/api/v1/prices?assetId=${asset.id}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(1)
  })
})
