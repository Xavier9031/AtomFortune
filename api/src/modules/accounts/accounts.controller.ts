import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { AccountsRepository } from './accounts.repository'
import { AccountsService } from './accounts.service'
import { AssetsRepository } from '../assets/assets.repository'
import { HoldingsRepository } from '../holdings/holdings.repository'
import { AccountCreateSchema, AccountUpdateSchema, BalanceSetSchema } from './accounts.schema'

const accountsController = new Hono()
const service = new AccountsService(
  new AccountsRepository(db),
  new AssetsRepository(db),
  new HoldingsRepository(db),
)

accountsController.get('/', async (c) => c.json(await service.findAll()))
accountsController.post('/', zValidator('json', AccountCreateSchema), async (c) => {
  return c.json(await service.createAccount(c.req.valid('json')), 201)
})
accountsController.patch('/:id', zValidator('json', AccountUpdateSchema), async (c) => {
  return c.json(await service.updateAccount(c.req.param('id'), c.req.valid('json')))
})
accountsController.patch('/:id/balance', zValidator('json', BalanceSetSchema), async (c) => {
  return c.json(await service.setBalance(c.req.param('id'), c.req.valid('json').balance, c.req.valid('json').currencyCode))
})
accountsController.delete('/:id', async (c) => {
  await service.deleteAccount(c.req.param('id'))
  return c.body(null, 204)
})

export default accountsController
