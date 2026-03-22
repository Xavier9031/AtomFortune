import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import app from '../src/index'
import { cleanDb, closeDb } from './helpers/db'

beforeEach(() => cleanDb())
afterAll(() => closeDb())

describe('POST /api/v1/assets', () => {
  it('creates an asset and returns 201', async () => {
    const res = await app.request('/api/v1/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'AAPL', assetClass: 'asset', category: 'investment',
        subKind: 'stock', symbol: 'AAPL', market: 'NASDAQ',
        currencyCode: 'USD', pricingMode: 'market',
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBeDefined()
    expect(body.name).toBe('AAPL')
  })

  it('returns 422 for invalid assetClass/category combo', async () => {
    const res = await app.request('/api/v1/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bad', assetClass: 'liability', category: 'investment',
        subKind: 'stock', currencyCode: 'TWD', pricingMode: 'fixed',
      }),
    })
    expect(res.status).toBe(422)
  })
})

describe('GET /api/v1/assets', () => {
  it('returns empty array when no assets', async () => {
    const res = await app.request('/api/v1/assets')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

describe('PATCH /api/v1/assets/:id', () => {
  it('updates mutable fields name/symbol/market', async () => {
    const create = await app.request('/api/v1/assets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'TSLA', assetClass: 'asset', category: 'investment',
        subKind: 'stock', currencyCode: 'USD', pricingMode: 'market' }),
    })
    const { id } = await create.json()
    const res = await app.request(`/api/v1/assets/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Tesla Inc', symbol: 'TSLA', market: 'NASDAQ' }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).name).toBe('Tesla Inc')
  })
})

describe('DELETE /api/v1/assets/:id', () => {
  it('deletes an asset and returns 204', async () => {
    const create = await app.request('/api/v1/assets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'DEL', assetClass: 'asset', category: 'liquid',
        subKind: 'bank_account', currencyCode: 'TWD', pricingMode: 'fixed' }),
    })
    const { id } = await create.json()
    const res = await app.request(`/api/v1/assets/${id}`, { method: 'DELETE' })
    expect(res.status).toBe(204)
  })
})
