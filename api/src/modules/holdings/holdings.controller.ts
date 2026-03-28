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
import { resolvePrice, resolveFxRate } from '../../jobs/snapshot.job'
import { prices, snapshotItems } from '../../db/schema'

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
  const accountId = c.req.param('accountId')
  const holding = await service.upsert(userId, assetId, accountId, c.req.valid('json'))

  // Synchronously compute and save today's snapshot item so the value shows immediately
  const assetsRepo = new AssetsRepository(db)
  const asset = await assetsRepo.findById(assetId, userId)
  if (asset) {
    const today = new Date().toISOString().slice(0, 10)

    // For market assets, fetch latest price first
    if (asset.pricingMode === 'market' && asset.symbol) {
      try {
        const priceMap = await fetchMarketPrices([asset])
        const price = priceMap.get(assetId)
        if (price != null) {
          await db.insert(prices)
            .values({ assetId, priceDate: today, price: String(price), source: 'yahoo-finance2' })
            .onConflictDoUpdate({
              target: [prices.assetId, prices.priceDate],
              set: { price: String(price), source: 'yahoo-finance2', updatedAt: new Date().toISOString() },
            })
        }
      } catch (err) {
        console.warn(`Auto price fetch failed for ${asset.symbol}:`, err)
      }
    }

    // Create snapshot item for this holding
    try {
      const price = await resolvePrice(db, assetId, asset.pricingMode, today)
      const fxRate = await resolveFxRate(db, asset.currencyCode, today)
      if (price != null) {
        const qty = Number(c.req.valid('json').quantity)
        const valueInBase = qty * price * fxRate
        await db.insert(snapshotItems)
          .values({
            snapshotDate: today, assetId, accountId, userId,
            quantity: String(qty), price: String(price),
            fxRate: String(fxRate), valueInBase: String(valueInBase),
          })
          .onConflictDoUpdate({
            target: [snapshotItems.snapshotDate, snapshotItems.assetId, snapshotItems.accountId],
            set: {
              quantity: String(qty), price: String(price),
              fxRate: String(fxRate), valueInBase: String(valueInBase),
              updatedAt: new Date().toISOString(),
            },
          })
      }
    } catch (err) {
      console.warn('Snapshot item creation failed:', err)
    }
  }

  return c.json(holding)
})

holdingsController.delete('/:assetId/:accountId', async (c) => {
  const userId = getUserId(c)
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)
  await service.delete(userId, c.req.param('assetId'), c.req.param('accountId'))
  return c.body(null, 204)
})

export default holdingsController
