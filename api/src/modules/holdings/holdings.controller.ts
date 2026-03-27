import { Hono } from 'hono'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { HoldingsRepository } from './holdings.repository'
import { HoldingsService } from './holdings.service'
import { AssetsRepository } from '../assets/assets.repository'
import { AccountsRepository } from '../accounts/accounts.repository'
import { HoldingUpsertSchema } from './holdings.schema'
import { fetchMarketPrices } from '../../jobs/pricing.service'
import { prices } from '../../db/schema'

function getUserId(c: Context): string | null {
  return c.req.header('x-user-id') ?? null
}

const holdingsController = new Hono()
const service = new HoldingsService(
  new HoldingsRepository(db),
  new AssetsRepository(db),
  new AccountsRepository(db),
)

holdingsController.get('/', async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  const accountId = c.req.query('accountId')
  return c.json(await service.findAll(userId, accountId))
})

holdingsController.put('/:assetId/:accountId', zValidator('json', HoldingUpsertSchema, (result, c) => {
  if (!result.success) return c.json({ error: result.error.issues }, 422)
}), async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  const assetId = c.req.param('assetId')
  const holding = await service.upsert(
    userId, assetId, c.req.param('accountId'), c.req.valid('json')
  )

  // Fire-and-forget: fetch latest price for market-priced assets
  const assetsRepo = new AssetsRepository(db)
  assetsRepo.findById(assetId, userId).then(async (asset) => {
    if (!asset || asset.pricingMode !== 'market' || !asset.symbol) return
    try {
      const priceMap = await fetchMarketPrices([asset])
      const price = priceMap.get(assetId)
      if (price != null) {
        const today = new Date().toISOString().slice(0, 10)
        await db.insert(prices)
          .values({ assetId, priceDate: today, price: String(price), source: 'yahoo-finance2' })
          .onConflictDoUpdate({
            target: [prices.assetId, prices.priceDate],
            set: { price: String(price), source: 'yahoo-finance2', updatedAt: new Date().toISOString() },
          })
        console.log(`Auto-fetched price for ${asset.symbol}: ${price}`)
      }
    } catch (err) {
      console.warn(`Auto price fetch failed for ${asset.symbol}:`, err)
    }
  })

  return c.json(holding)
})

holdingsController.delete('/:assetId/:accountId', async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  await service.delete(userId, c.req.param('assetId'), c.req.param('accountId'))
  return c.body(null, 204)
})

export default holdingsController
