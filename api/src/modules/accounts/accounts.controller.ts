import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { AccountsRepository } from './accounts.repository'
import { AccountsService } from './accounts.service'
import { AccountCreateSchema, AccountUpdateSchema } from './accounts.schema'

const accountsController = new Hono()
const service = new AccountsService(new AccountsRepository(db))

accountsController.get('/', async (c) => c.json(await service.findAll()))
accountsController.post('/', zValidator('json', AccountCreateSchema), async (c) => {
  return c.json(await service.createAccount(c.req.valid('json')), 201)
})
accountsController.patch('/:id', zValidator('json', AccountUpdateSchema), async (c) => {
  return c.json(await service.updateAccount(c.req.param('id'), c.req.valid('json')))
})
accountsController.delete('/:id', async (c) => {
  await service.deleteAccount(c.req.param('id'))
  return c.body(null, 204)
})

export default accountsController
