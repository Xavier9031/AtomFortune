import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
vi.mock('../src/jobs/pricing.service', () => ({
  fetchMarketPrices: vi.fn().mockResolvedValue(new Map()),
}))
import app from '../src/index'
import { cleanDb, closeDb, seedTestUser } from './helpers/db'

const USER_HEADER = { 'x-user-id': 'default-user' }

beforeEach(async () => { cleanDb(); await seedTestUser() })
afterAll(() => closeDb())

describe('POST /api/v1/assets', () => {
  it('creates an asset and returns 201', async () => {
    const res = await app.request('/api/v1/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...USER_HEADER },
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
    expect(body.unit).toBe('shares')
  })

  it('normalizes liquid asset units to the asset currency', async () => {
    const res = await app.request('/api/v1/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...USER_HEADER },
      body: JSON.stringify({
        name: 'Cash', assetClass: 'asset', category: 'liquid',
        subKind: 'physical_cash', currencyCode: 'TWD', pricingMode: 'fixed',
        unit: 'gram',
      }),
    })
    expect(res.status).toBe(201)
    expect((await res.json()).unit).toBe('TWD')
  })

  it('normalizes crypto units to the ticker symbol', async () => {
    const res = await app.request('/api/v1/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...USER_HEADER },
      body: JSON.stringify({
        name: 'Bitcoin', assetClass: 'asset', category: 'investment',
        subKind: 'crypto', symbol: 'btc', currencyCode: 'USD', pricingMode: 'market',
        unit: 'unit',
      }),
    })
    expect(res.status).toBe(201)
    expect((await res.json()).unit).toBe('BTC')
  })

  it('returns 422 for invalid assetClass/category combo', async () => {
    const res = await app.request('/api/v1/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...USER_HEADER },
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
    const res = await app.request('/api/v1/assets', { headers: USER_HEADER })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('only returns assets belonging to the requesting user', async () => {
    // Create asset for the default test user
    await app.request('/api/v1/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...USER_HEADER },
      body: JSON.stringify({ name: 'Mine', assetClass: 'asset', category: 'investment',
        subKind: 'stock', currencyCode: 'USD', pricingMode: 'market' }),
    })
    // Create user B and their asset
    const userB = await seedTestUser('User B')
    await app.request('/api/v1/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userB.id },
      body: JSON.stringify({ name: 'Theirs', assetClass: 'asset', category: 'investment',
        subKind: 'stock', currencyCode: 'USD', pricingMode: 'market' }),
    })
    // Default user should only see their own asset
    const res = await app.request('/api/v1/assets', { headers: USER_HEADER })
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('Mine')
  })
})

describe('PATCH /api/v1/assets/:id', () => {
  it('updates mutable fields name/symbol/market', async () => {
    const create = await app.request('/api/v1/assets', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...USER_HEADER },
      body: JSON.stringify({ name: 'TSLA', assetClass: 'asset', category: 'investment',
        subKind: 'stock', currencyCode: 'USD', pricingMode: 'market' }),
    })
    const { id } = await create.json()
    const res = await app.request(`/api/v1/assets/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...USER_HEADER },
      body: JSON.stringify({ name: 'Tesla Inc', symbol: 'TSLA', market: 'NASDAQ' }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).name).toBe('Tesla Inc')
  })

  it('self-heals invalid liquid units on update', async () => {
    const create = await app.request('/api/v1/assets', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...USER_HEADER },
      body: JSON.stringify({
        name: 'Cash', assetClass: 'asset', category: 'liquid',
        subKind: 'physical_cash', currencyCode: 'TWD', pricingMode: 'fixed',
        unit: 'gram',
      }),
    })
    const { id } = await create.json()
    const res = await app.request(`/api/v1/assets/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...USER_HEADER },
      body: JSON.stringify({ name: 'Wallet Cash' }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).unit).toBe('TWD')
  })
})

describe('DELETE /api/v1/assets/:id', () => {
  it('deletes an asset and returns 204', async () => {
    const create = await app.request('/api/v1/assets', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...USER_HEADER },
      body: JSON.stringify({ name: 'DEL', assetClass: 'asset', category: 'liquid',
        subKind: 'bank_account', currencyCode: 'TWD', pricingMode: 'fixed' }),
    })
    const { id } = await create.json()
    const res = await app.request(`/api/v1/assets/${id}`, { method: 'DELETE', headers: USER_HEADER })
    expect(res.status).toBe(204)
  })
})
