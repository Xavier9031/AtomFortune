import { Hono } from 'hono'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { AccountsRepository } from './accounts.repository'
import { AccountsService } from './accounts.service'
import { AssetsRepository } from '../assets/assets.repository'
import { HoldingsRepository } from '../holdings/holdings.repository'
import { AccountCreateSchema, AccountUpdateSchema, BalanceSetSchema } from './accounts.schema'
import { refreshUserSnapshot } from '../../jobs/snapshot.job'

function getUserId(c: Context): string | null {
  return c.req.header('x-user-id') ?? null
}

const accountsController = new Hono()
const service = new AccountsService(
  new AccountsRepository(db),
  new AssetsRepository(db),
  new HoldingsRepository(db),
)

accountsController.get('/', async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  return c.json(await service.findAll(userId))
})

accountsController.post('/', zValidator('json', AccountCreateSchema), async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  return c.json(await service.createAccount(userId, c.req.valid('json')), 201)
})

accountsController.patch('/:id', zValidator('json', AccountUpdateSchema), async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  return c.json(await service.updateAccount(c.req.param('id'), userId, c.req.valid('json')))
})

accountsController.patch('/:id/balance', zValidator('json', BalanceSetSchema), async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  const result = await service.setBalance(userId, c.req.param('id'), c.req.valid('json').balance, c.req.valid('json').currencyCode)

  // Refresh snapshot items for all holdings after balance change
  try {
    await refreshUserSnapshot(db, userId)
  } catch (err) {
    console.warn('Snapshot refresh after balance set failed:', err)
  }

  return c.json(result)
})

accountsController.delete('/:id', async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  await service.deleteAccount(c.req.param('id'), userId)
  return c.body(null, 204)
})

export default accountsController
