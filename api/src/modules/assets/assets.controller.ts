import { Hono } from 'hono'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { AssetsRepository } from './assets.repository'
import { AssetsService } from './assets.service'
import { SnapshotItemsRepository } from '../snapshot-items/snapshot-items.repository'
import { PricesRepository } from '../prices/prices.repository'
import { AssetCreateSchema, AssetUpdateSchema } from './assets.schema'

function getUserId(c: Context): string | null {
  return c.req.header('x-user-id') ?? null
}

const assetsController = new Hono()
const repo = new AssetsRepository(db)
const snapshotRepo = new SnapshotItemsRepository(db)
const pricesRepo = new PricesRepository(db)
const service = new AssetsService(repo, snapshotRepo, pricesRepo)

assetsController.get('/', async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  return c.json(await service.findAll(userId))
})

assetsController.get('/:id', async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  const asset = await service.findById(c.req.param('id'), userId)
  if (!asset) return c.json({ error: 'Not found' }, 404)
  return c.json(asset)
})

assetsController.post('/', zValidator('json', AssetCreateSchema), async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  return c.json(await service.createAsset(userId, c.req.valid('json')), 201)
})

assetsController.patch('/:id', zValidator('json', AssetUpdateSchema), async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  const asset = await service.updateAsset(c.req.param('id'), userId, c.req.valid('json'))
  return c.json(asset)
})

assetsController.delete('/:id', async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  await service.deleteAsset(c.req.param('id'), userId)
  return c.body(null, 204)
})

export default assetsController
