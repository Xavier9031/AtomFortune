import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { FxRatesRepository } from './fx-rates.repository'
import { FxRatesService } from './fx-rates.service'
import { FxRateManualCreateSchema } from './fx-rates.schema'

const fxRatesController = new Hono()
const service = new FxRatesService(new FxRatesRepository(db))

fxRatesController.get('/', async (c) => {
  const { from, to, fromDate, toDate } = c.req.query()
  return c.json(await service.findAll({ from, to, fromDate, toDate }))
})

fxRatesController.post('/manual', zValidator('json', FxRateManualCreateSchema, (result, c) => {
  if (!result.success) return c.json({ error: 'Validation failed' }, 422)
}), async (c) => {
  return c.json(await service.createManual(c.req.valid('json')), 201)
})

export default fxRatesController
