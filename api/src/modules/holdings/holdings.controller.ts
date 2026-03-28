import { Hono } from 'hono'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { HoldingsRepository } from './holdings.repository'
import { HoldingsService } from './holdings.service'
import { AssetsRepository } from '../assets/assets.repository'
import { AccountsRepository } from '../accounts/accounts.repository'
import { HoldingUpsertSchema } from './holdings.schema'

function getUserId(c: Context): string | null {
  return c.req.header('x-user-id') ?? null
}

const holdingsController = new Hono()
const service = new HoldingsService(
  db,
  new HoldingsRepository(db),
  new AssetsRepository(db),
  new AccountsRepository(db),
)

holdingsController.get('/', async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  const accountId = c.req.query('accountId')
  return c.json(await service.findAll(userId, accountId))
})

holdingsController.put('/:assetId/:accountId', zValidator('json', HoldingUpsertSchema, (result, c) => {
  if (!result.success) return c.json({ error: result.error.issues }, 422)
}), async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  const holding = await service.upsert(
    userId, c.req.param('assetId'), c.req.param('accountId'), c.req.valid('json')
  )
  return c.json(holding)
})

holdingsController.delete('/:assetId/:accountId', async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  await service.delete(userId, c.req.param('assetId'), c.req.param('accountId'))
  return c.body(null, 204)
})

export default holdingsController
