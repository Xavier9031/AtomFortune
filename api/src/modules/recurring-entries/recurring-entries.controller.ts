import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { RecurringEntriesRepository } from './recurring-entries.repository'
import { RecurringEntryCreateSchema, RecurringEntryUpdateSchema } from './recurring-entries.schema'

const recurringEntriesController = new Hono()
const repo = new RecurringEntriesRepository(db)

recurringEntriesController.get('/', async (c) => {
  const { assetId, accountId } = c.req.query()
  return c.json(await repo.findAll({ assetId, accountId }))
})

recurringEntriesController.post('/', zValidator('json', RecurringEntryCreateSchema), async (c) => {
  return c.json(await repo.create(c.req.valid('json')), 201)
})

recurringEntriesController.patch('/:id', zValidator('json', RecurringEntryUpdateSchema), async (c) => {
  return c.json(await repo.update(c.req.param('id'), c.req.valid('json')))
})

recurringEntriesController.delete('/:id', async (c) => {
  await repo.delete(c.req.param('id'))
  return c.body(null, 204)
})

export default recurringEntriesController
