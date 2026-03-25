import { Hono } from 'hono'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../../db/client'
import { PricesRepository } from './prices.repository'
import { PricesService } from './prices.service'
import { AssetsRepository } from '../assets/assets.repository'
import { PriceManualCreateSchema } from './prices.schema'

function getUserId(c: Context): string | null {
  return c.req.header('x-user-id') ?? null
}

const pricesController = new Hono()
const service = new PricesService(new PricesRepository(db), new AssetsRepository(db))

pricesController.get('/', async (c) => {
  const { assetId, from, to } = c.req.query()
  return c.json(await service.findAll({ assetId, from, to }))
})

pricesController.post('/manual', zValidator('json', PriceManualCreateSchema, (result, c) => {
  if (!result.success) return c.json({ error: 'Validation failed' }, 422)
}), async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  return c.json(await service.createManual(userId, c.req.valid('json')), 201)
})

// Admin/demo endpoint: bulk seed prices for any asset, bypassing pricingMode check
pricesController.post('/seed', zValidator('json', z.array(z.object({
  assetId: z.string().uuid(),
  priceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  price: z.number().min(0),
})), (result, c) => {
  if (!result.success) return c.json({ error: 'Validation failed' }, 422)
}), async (c) => {
  const items = c.req.valid('json')
  const inserted = await service.seedBulk(items)
  return c.json({ inserted })
})

export default pricesController
