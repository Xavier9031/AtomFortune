import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import app from '../src/index'
import { cleanDb, closeDb } from './helpers/db'

beforeEach(() => cleanDb())
afterAll(() => closeDb())

describe('POST /api/v1/fx-rates/manual', () => {
  it('creates an FX rate and returns 201', async () => {
    const res = await app.request('/api/v1/fx-rates/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromCurrency: 'USD', toCurrency: 'TWD',
        rateDate: '2026-03-22', rate: 32.67 }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.fromCurrency).toBe('USD')
    expect(body.rate).toBe('32.6700000000')
  })

  it('upserts on conflict (same currency pair + date)', async () => {
    const payload = { fromCurrency: 'USD', toCurrency: 'TWD', rateDate: '2026-03-22', rate: 32.00 }
    await app.request('/api/v1/fx-rates/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const res = await app.request('/api/v1/fx-rates/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, rate: 32.50 }),
    })
    expect(res.status).toBe(201)
    expect((await res.json()).rate).toBe('32.5000000000')
  })

  it('returns 422 if rate is zero or negative', async () => {
    const res = await app.request('/api/v1/fx-rates/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromCurrency: 'USD', toCurrency: 'TWD',
        rateDate: '2026-03-22', rate: 0 }),
    })
    expect(res.status).toBe(422)
  })
})

describe('GET /api/v1/fx-rates', () => {
  it('returns fx rate history filtered by from/to', async () => {
    await app.request('/api/v1/fx-rates/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromCurrency: 'JPY', toCurrency: 'TWD',
        rateDate: '2026-03-22', rate: 0.21 }),
    })
    const res = await app.request('/api/v1/fx-rates?from=JPY&to=TWD')
    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(1)
  })
})
