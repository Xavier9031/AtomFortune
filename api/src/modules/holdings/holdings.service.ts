import { HoldingsRepository } from './holdings.repository'
import { AssetsRepository } from '../assets/assets.repository'
import { AccountsRepository } from '../accounts/accounts.repository'
import { HoldingUpsertInput } from './holdings.schema'
import { HTTPException } from 'hono/http-exception'
import { fetchMarketPrices } from '../../jobs/pricing.service'
import { refreshUserSnapshot } from '../../jobs/snapshot.job'
import { prices } from '../../db/schema'
import type { DrizzleDB } from '../../db/client'

export class HoldingsService {
  constructor(
    private db: DrizzleDB,
    private repo: HoldingsRepository,
    private assetsRepo: AssetsRepository,
    private accountsRepo: AccountsRepository,
  ) {}

  findAll(userId: string, accountId?: string) { return this.repo.findAll(userId, accountId) }

  async upsert(userId: string, assetId: string, accountId: string, data: HoldingUpsertInput) {
    const asset = await this.assetsRepo.findById(assetId, userId)
    if (!asset) throw new HTTPException(404, { message: 'Asset not found' })
    const account = await this.accountsRepo.findById(accountId, userId)
    if (!account) throw new HTTPException(404, { message: 'Account not found' })
    const result = await this.repo.upsert(userId, assetId, accountId, String(data.quantity))

    // Fetch latest market price if applicable
    const today = new Date().toISOString().slice(0, 10)
    if (asset.pricingMode === 'market' && asset.symbol) {
      try {
        const priceMap = await fetchMarketPrices([asset])
        const price = priceMap.get(assetId)
        if (price != null) {
          await this.db.insert(prices)
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

    // Refresh snapshot items for ALL of this user's holdings
    try {
      await refreshUserSnapshot(this.db, userId, today)
    } catch (err) {
      console.warn('Snapshot refresh failed:', err)
    }

    return result
  }

  /** Upsert holding by raw quantity (used by AccountsService.setBalance). Skips asset/account validation. */
  async upsertDirect(userId: string, assetId: string, accountId: string, quantity: string) {
    const result = await this.repo.upsert(userId, assetId, accountId, quantity)
    try {
      await refreshUserSnapshot(this.db, userId)
    } catch (err) {
      console.warn('Snapshot refresh failed:', err)
    }
    return result
  }

  async delete(userId: string, assetId: string, accountId: string) {
    const existing = await this.repo.findOne(userId, assetId, accountId)
    if (!existing) throw new HTTPException(404, { message: 'Holding not found' })
    return this.repo.delete(userId, assetId, accountId)
  }
}
