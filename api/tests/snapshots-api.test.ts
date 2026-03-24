import { describe, it, expect, vi, beforeEach } from 'vitest'
import app from '../src/index'

vi.mock('../src/modules/snapshots/snapshots.repository', () => ({
  getSnapshotHistory: vi.fn(),
  getSnapshotByDate: vi.fn(),
  getSnapshotItemsByAsset: vi.fn(),
}))
vi.mock('../src/jobs/snapshot.job', () => ({ dailySnapshotJob: vi.fn() }))

import * as repo from '../src/modules/snapshots/snapshots.repository'
import { dailySnapshotJob } from '../src/jobs/snapshot.job'

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001'
const userHeaders = { 'x-user-id': TEST_USER_ID }

describe('GET /api/v1/snapshots/history', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with array for valid range', async () => {
    vi.mocked(repo.getSnapshotHistory).mockResolvedValue([
      { snapshotDate: '2026-03-22', netWorth: '12847320.00' },
    ])
    const res = await app.request('/api/v1/snapshots/history?range=30d', { headers: userHeaders })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].snapshotDate).toBe('2026-03-22')
  })

  it('returns 400 for invalid range param', async () => {
    const res = await app.request('/api/v1/snapshots/history?range=bad', { headers: userHeaders })
    expect(res.status).toBe(400)
  })

  it('returns 400 when x-user-id header is missing', async () => {
    const res = await app.request('/api/v1/snapshots/history?range=30d')
    expect(res.status).toBe(400)
  })
})

describe('GET /api/v1/snapshots/items', () => {
  it('returns value series for a given assetId and range', async () => {
    vi.mocked(repo.getSnapshotItemsByAsset).mockResolvedValue([
      { snapshotDate: '2026-03-22', valueInBase: '87320.00' },
    ])
    const res = await app.request('/api/v1/snapshots/items?assetId=00000000-0000-0000-0000-000000000001&range=1y', { headers: userHeaders })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].valueInBase).toBe('87320.00')
  })
})

describe('GET /api/v1/snapshots/:date', () => {
  it('returns snapshot detail when found', async () => {
    vi.mocked(repo.getSnapshotByDate).mockResolvedValue({
      snapshotDate: '2026-03-22', netWorth: 12847320, items: [],
    } as any)
    const res = await app.request('/api/v1/snapshots/2026-03-22', { headers: userHeaders })
    expect(res.status).toBe(200)
  })

  it('returns 404 when snapshot does not exist', async () => {
    vi.mocked(repo.getSnapshotByDate).mockResolvedValue(null)
    const res = await app.request('/api/v1/snapshots/2099-01-01', { headers: userHeaders })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/v1/snapshots/rebuild/:date', () => {
  it('calls dailySnapshotJob and returns rebuilt count', async () => {
    vi.mocked(dailySnapshotJob).mockResolvedValue(undefined as any)
    const res = await app.request('/api/v1/snapshots/rebuild/2026-03-22', { method: 'POST', headers: userHeaders })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rebuilt).toBe(1)
  })
})

describe('POST /api/v1/snapshots/rebuild-range', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls dailySnapshotJob once per date in range', async () => {
    vi.mocked(dailySnapshotJob).mockResolvedValue(undefined as any)
    const res = await app.request('/api/v1/snapshots/rebuild-range', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userHeaders },
      body: JSON.stringify({ from: '2026-03-20', to: '2026-03-22' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rebuilt).toBe(3)
    expect(dailySnapshotJob).toHaveBeenCalledTimes(3)
  })

  it('returns 400 if from > to', async () => {
    const res = await app.request('/api/v1/snapshots/rebuild-range', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userHeaders },
      body: JSON.stringify({ from: '2026-03-25', to: '2026-03-20' }),
    })
    expect(res.status).toBe(400)
  })
})
