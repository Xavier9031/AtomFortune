import { Hono } from 'hono'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { TransactionsRepository } from './transactions.repository'
import { TransactionsService } from './transactions.service'
import { TransactionCreateSchema, TransactionPatchSchema } from './transactions.schema'

function getUserId(c: Context): string | null {
  return c.req.header('x-user-id') ?? null
}

const transactionsController = new Hono()
const service = new TransactionsService(new TransactionsRepository(db))

transactionsController.get('/', async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  const { assetId, accountId, from, to } = c.req.query()
  return c.json(await service.findAll(userId, { assetId, accountId, from, to }))
})

transactionsController.post('/', zValidator('json', TransactionCreateSchema), async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  return c.json(await service.create(userId, c.req.valid('json')), 201)
})

transactionsController.patch('/:id', zValidator('json', TransactionPatchSchema), async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  return c.json(await service.updateNote(c.req.param('id'), userId, c.req.valid('json')))
})

transactionsController.delete('/:id', async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  await service.delete(c.req.param('id'), userId)
  return c.body(null, 204)
})

export default transactionsController
