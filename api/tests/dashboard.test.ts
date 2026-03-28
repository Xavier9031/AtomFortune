import { describe, it, expect, vi, beforeEach } from 'vitest'
import app from '../src/index'

const USER_HEADER = { 'x-user-id': 'default-user' }

vi.mock('../src/modules/dashboard/dashboard.repository', () => ({
  getLatestSnapshotDate: vi.fn(),
  getSummaryForDate: vi.fn(),
  getPreviousSummary: vi.fn(),
  getFxRateForDisplay: vi.fn(),
  getFxRatesForDisplayDates: vi.fn(),
  getAllocationForDate: vi.fn(),
  getNetWorthHistory: vi.fn(),
  getCategoryHistory: vi.fn(),
}))

import * as repo from '../src/modules/dashboard/dashboard.repository'

describe('GET /api/v1/dashboard/summary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with correct netWorth and change fields', async () => {
    vi.mocked(repo.getLatestSnapshotDate).mockResolvedValue('2026-03-22')
    vi.mocked(repo.getSummaryForDate).mockResolvedValue({
      totalAssets: '13199320.00', totalLiabilities: '352000.00',
    })
    vi.mocked(repo.getPreviousSummary).mockResolvedValue({
      snapshotDate: '2026-03-21',
      netWorth: '12558320.00',
    })
    vi.mocked(repo.getFxRateForDisplay).mockResolvedValue(1.0)

    const res = await app.request('/api/v1/dashboard/summary?displayCurrency=TWD', { headers: USER_HEADER })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.snapshotDate).toBe('2026-03-22')
    expect(body.netWorth).toBeCloseTo(13199320 - 352000)
    expect(body.changeAmount).not.toBeNull()
    expect(body.changePct).not.toBeNull()
  })

  it('returns null change fields when no previous snapshot exists', async () => {
    vi.mocked(repo.getLatestSnapshotDate).mockResolvedValue('2026-03-22')
    vi.mocked(repo.getSummaryForDate).mockResolvedValue({
      totalAssets: '5000000.00', totalLiabilities: '0.00',
    })
    vi.mocked(repo.getPreviousSummary).mockResolvedValue(null)
    vi.mocked(repo.getFxRateForDisplay).mockResolvedValue(1.0)

    const res = await app.request('/api/v1/dashboard/summary?displayCurrency=TWD', { headers: USER_HEADER })
    const body = await res.json()
    expect(body.changeAmount).toBeNull()
    expect(body.changePct).toBeNull()
  })

  it('returns 404 when no snapshots exist at all', async () => {
    vi.mocked(repo.getLatestSnapshotDate).mockResolvedValue(null)
    const res = await app.request('/api/v1/dashboard/summary?displayCurrency=TWD', { headers: USER_HEADER })
    expect(res.status).toBe(404)
  })

  it('applies display currency conversion', async () => {
    vi.mocked(repo.getLatestSnapshotDate).mockResolvedValue('2026-03-22')
    vi.mocked(repo.getSummaryForDate).mockResolvedValue({
      totalAssets: '3250000.00', totalLiabilities: '0.00',
    })
    vi.mocked(repo.getPreviousSummary).mockResolvedValue(null)
    vi.mocked(repo.getFxRateForDisplay).mockResolvedValue(32.5)

    const res = await app.request('/api/v1/dashboard/summary?displayCurrency=USD', { headers: USER_HEADER })
    const body = await res.json()
    expect(body.netWorth).toBeCloseTo(100000)
    expect(body.displayCurrency).toBe('USD')
  })
})

describe('GET /api/v1/dashboard/allocation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns categories with items and percentage', async () => {
    vi.mocked(repo.getLatestSnapshotDate).mockResolvedValue('2026-03-22')
    vi.mocked(repo.getAllocationForDate).mockResolvedValue([
      { category: 'investment', assetId: 'uuid-aapl', name: 'AAPL', valueInBase: '87320.00' },
      { category: 'liquid', assetId: 'uuid-cash', name: '郵局帳戶', valueInBase: '500000.00' },
    ])
    vi.mocked(repo.getFxRateForDisplay).mockResolvedValue(1.0)

    const res = await app.request('/api/v1/dashboard/allocation?displayCurrency=TWD', { headers: USER_HEADER })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.categories).toHaveLength(2)
    const investment = body.categories.find((c: any) => c.category === 'investment')
    expect(investment?.color).toBe('#7c3aed')
    expect(investment?.items[0].name).toBe('AAPL')
    expect(investment?.pct).toBeCloseTo((87320 / (87320 + 500000)) * 100, 1)
  })
})

describe('GET /api/v1/dashboard/net-worth-history', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns data array with correct netWorth per date', async () => {
    vi.mocked(repo.getNetWorthHistory).mockResolvedValue([
      { snapshotDate: '2026-03-21', netWorth: '12558320.00' },
      { snapshotDate: '2026-03-22', netWorth: '12847320.00' },
    ])
    vi.mocked(repo.getFxRatesForDisplayDates).mockResolvedValue(new Map([
      ['2026-03-21', 32.5],
      ['2026-03-22', 31.8],
    ]))

    const res = await app.request('/api/v1/dashboard/net-worth-history?range=30d&displayCurrency=USD', { headers: USER_HEADER })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.displayCurrency).toBe('USD')
    expect(body.data).toHaveLength(2)
    expect(body.data[0].netWorth).toBeCloseTo(12558320 / 32.5, 0)
    expect(body.data[1].netWorth).toBeCloseTo(12847320 / 31.8, 0)
  })

  it('returns 400 for invalid range', async () => {
    const res = await app.request('/api/v1/dashboard/net-worth-history?range=bad', { headers: USER_HEADER })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/v1/dashboard/category-history', () => {
  beforeEach(() => vi.clearAllMocks())

  it('converts category history using each point date FX rate', async () => {
    vi.mocked(repo.getCategoryHistory).mockResolvedValue([
      { snapshotDate: '2026-03-21', category: 'investment', assetClass: 'asset', value: '3250000.00' },
      { snapshotDate: '2026-03-22', category: 'investment', assetClass: 'asset', value: '3180000.00' },
    ])
    vi.mocked(repo.getFxRatesForDisplayDates).mockResolvedValue(new Map([
      ['2026-03-21', 32.5],
      ['2026-03-22', 31.8],
    ]))

    const res = await app.request('/api/v1/dashboard/category-history?range=30d&displayCurrency=USD', { headers: USER_HEADER })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].investment).toBeCloseTo(3250000 / 32.5, 0)
    expect(body.data[1].investment).toBeCloseTo(3180000 / 31.8, 0)
  })
})
