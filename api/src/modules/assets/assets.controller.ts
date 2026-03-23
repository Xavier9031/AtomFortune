import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { AssetsRepository } from './assets.repository'
import { AssetsService } from './assets.service'
import { SnapshotItemsRepository } from '../snapshot-items/snapshot-items.repository'
import { AssetCreateSchema, AssetUpdateSchema } from './assets.schema'

const assetsController = new Hono()
const repo = new AssetsRepository(db)
const snapshotRepo = new SnapshotItemsRepository(db)
const service = new AssetsService(repo, snapshotRepo)

assetsController.get('/', async (c) => c.json(await service.findAll()))

assetsController.post('/', zValidator('json', AssetCreateSchema), async (c) => {
  return c.json(await service.createAsset(c.req.valid('json')), 201)
})

assetsController.patch('/:id', zValidator('json', AssetUpdateSchema), async (c) => {
  const asset = await service.updateAsset(c.req.param('id'), c.req.valid('json'))
  return c.json(asset)
})

assetsController.delete('/:id', async (c) => {
  await service.deleteAsset(c.req.param('id'))
  return c.body(null, 204)
})

export default assetsController
