import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { PricesRepository } from './prices.repository'
import { PricesService } from './prices.service'
import { AssetsRepository } from '../assets/assets.repository'
import { PriceManualCreateSchema } from './prices.schema'

const pricesController = new Hono()
const service = new PricesService(new PricesRepository(db), new AssetsRepository(db))

pricesController.get('/', async (c) => {
  const { assetId, from, to } = c.req.query()
  return c.json(await service.findAll({ assetId, from, to }))
})

pricesController.post('/manual', zValidator('json', PriceManualCreateSchema, (result, c) => {
  if (!result.success) return c.json({ error: 'Validation failed' }, 422)
}), async (c) => {
  return c.json(await service.createManual(c.req.valid('json')), 201)
})

export default pricesController
