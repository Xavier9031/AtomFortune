import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Context } from 'hono'
import * as service from './snapshots.service'
import { dailySnapshotJob } from '../../jobs/snapshot.job'
import { db } from '../../db/client'

const rangeSchema = z.enum(['30d', '1y', 'all']).default('30d')

function getUserId(c: Context): string | null {
  return c.req.header('x-user-id') ?? null
}

export const snapshotsRouter = new Hono()

snapshotsRouter.get('/history',
  zValidator('query', z.object({ range: rangeSchema })),
  async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'x-user-id header required' }, 400)
    const { range } = c.req.valid('query')
    const rows = await service.listHistory(userId, range)
    return c.json(rows.map(r => ({ snapshotDate: r.snapshotDate, netWorth: r.netWorth })))
  }
)

snapshotsRouter.get('/items',
  zValidator('query', z.object({ assetId: z.string().uuid(), range: rangeSchema })),
  async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'x-user-id header required' }, 400)
    const { assetId, range } = c.req.valid('query')
    const rows = await service.listItemsByAsset(userId, assetId, range)
    return c.json(rows.map(r => ({ snapshotDate: r.snapshotDate, valueInBase: r.valueInBase })))
  }
)

snapshotsRouter.get('/:date',
  zValidator('param', z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })),
  async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'x-user-id header required' }, 400)
    const { date } = c.req.valid('param')
    const detail = await service.getDetail(userId, date)
    if (!detail) return c.json({ error: 'Not found' }, 404)
    return c.json(detail)
  }
)

snapshotsRouter.post('/rebuild/:date',
  zValidator('param', z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })),
  async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'x-user-id header required' }, 400)
    const { date } = c.req.valid('param')
    const result = await service.rebuildDate(date)
    return c.json(result)
  }
)

snapshotsRouter.post('/trigger', async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'x-user-id header required' }, 400)
  const dateParam = c.req.query('date')
  const snapshotDate = dateParam ? new Date(dateParam) : new Date()
  // Trigger runs globally for all users (batch operation)
  const result = await dailySnapshotJob(db, snapshotDate)
  return c.json(result)
})

snapshotsRouter.post('/rebuild-range',
  zValidator('json', z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).refine(d => d.from <= d.to, { message: 'from must be ≤ to' })),
  async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'x-user-id header required' }, 400)
    const { from, to } = c.req.valid('json')
    const result = await service.rebuildRange(from, to)
    return c.json(result)
  }
)
