import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { HoldingsRepository } from './holdings.repository'
import { HoldingsService } from './holdings.service'
import { AssetsRepository } from '../assets/assets.repository'
import { AccountsRepository } from '../accounts/accounts.repository'
import { HoldingUpsertSchema } from './holdings.schema'

const holdingsController = new Hono()
const service = new HoldingsService(
  new HoldingsRepository(db),
  new AssetsRepository(db),
  new AccountsRepository(db),
)

holdingsController.get('/', async (c) => {
  const accountId = c.req.query('accountId')
  return c.json(await service.findAll(accountId))
})

holdingsController.put('/:assetId/:accountId', zValidator('json', HoldingUpsertSchema, (result, c) => {
  if (!result.success) return c.json({ error: result.error.issues }, 422)
}), async (c) => {
  const holding = await service.upsert(
    c.req.param('assetId'), c.req.param('accountId'), c.req.valid('json')
  )
  return c.json(holding)
})

holdingsController.delete('/:assetId/:accountId', async (c) => {
  await service.delete(c.req.param('assetId'), c.req.param('accountId'))
  return c.body(null, 204)
})

export default holdingsController
