import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { TransactionsRepository } from './transactions.repository'
import { TransactionsService } from './transactions.service'
import { TransactionCreateSchema, TransactionPatchSchema } from './transactions.schema'

const transactionsController = new Hono()
const service = new TransactionsService(new TransactionsRepository(db))

transactionsController.get('/', async (c) => {
  const { assetId, accountId, from, to } = c.req.query()
  return c.json(await service.findAll({ assetId, accountId, from, to }))
})

transactionsController.post('/', zValidator('json', TransactionCreateSchema), async (c) => {
  return c.json(await service.create(c.req.valid('json')), 201)
})

transactionsController.patch('/:id', zValidator('json', TransactionPatchSchema), async (c) => {
  return c.json(await service.updateNote(c.req.param('id'), c.req.valid('json')))
})

transactionsController.delete('/:id', async (c) => {
  await service.delete(c.req.param('id'))
  return c.body(null, 204)
})

export default transactionsController
