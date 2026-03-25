import { Hono } from 'hono'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { RecurringEntriesRepository } from './recurring-entries.repository'
import { RecurringEntryCreateSchema, RecurringEntryUpdateSchema } from './recurring-entries.schema'

function getUserId(c: Context): string | null {
  return c.req.header('x-user-id') ?? null
}

const recurringEntriesController = new Hono()
const repo = new RecurringEntriesRepository(db)

recurringEntriesController.get('/', async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  const { assetId, accountId } = c.req.query()
  return c.json(await repo.findAll({ userId, assetId, accountId }))
})

recurringEntriesController.post('/', zValidator('json', RecurringEntryCreateSchema), async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  return c.json(await repo.create({ userId, ...c.req.valid('json') }), 201)
})

recurringEntriesController.patch('/:id', zValidator('json', RecurringEntryUpdateSchema), async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  return c.json(await repo.update(c.req.param('id'), userId, c.req.valid('json')))
})

recurringEntriesController.delete('/:id', async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  await repo.delete(c.req.param('id'), userId)
  return c.body(null, 204)
})

export default recurringEntriesController
