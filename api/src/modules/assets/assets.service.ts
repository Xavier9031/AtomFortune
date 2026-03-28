import { AssetsRepository } from './assets.repository'
import { SnapshotItemsRepository } from '../snapshot-items/snapshot-items.repository'
import { PricesRepository } from '../prices/prices.repository'
import { AssetCreateInput, AssetUpdateInput } from './assets.schema'
import { HTTPException } from 'hono/http-exception'
import { fetchMarketPrices } from '../../jobs/pricing.service'
import { isCategoryAllowed, normalizeAssetUnit } from './asset-rules'

export class AssetsService {
  constructor(
    private repo: AssetsRepository,
    private snapshotRepo: SnapshotItemsRepository,
    private pricesRepo: PricesRepository,
  ) {}

  async findAll(userId: string) { return this.repo.findAll(userId) }
  async findById(id: string, userId: string) { return this.repo.findById(id, userId) }

  async createAsset(userId: string, data: AssetCreateInput) {
    if (!isCategoryAllowed(data.assetClass, data.category)) {
      const message = data.assetClass === 'asset'
        ? 'Invalid category for assetClass=asset'
        : 'category must be debt for liability'
      throw new HTTPException(422, { message })
    }
    const asset = await this.repo.create({
      userId,
      name: data.name, assetClass: data.assetClass, category: data.category,
      subKind: data.subKind, symbol: data.symbol ?? null, market: data.market ?? null,
      currencyCode: data.currencyCode, pricingMode: data.pricingMode,
      unit: normalizeAssetUnit({
        subKind: data.subKind,
        currencyCode: data.currencyCode,
        symbol: data.symbol ?? null,
        unit: data.unit ?? null,
      }),
    })

    // Fire-and-forget: fetch today's price for new market assets
    if (asset.pricingMode === 'market' && asset.symbol) {
      const today = new Date().toISOString().slice(0, 10)
      fetchMarketPrices([{ id: asset.id, symbol: asset.symbol, pricingMode: 'market', subKind: asset.subKind }])
        .then(pricesMap => {
          const price = pricesMap.get(asset.id)
          if (price != null) return this.pricesRepo.upsert(asset.id, today, String(price), 'yahoo-finance2')
        })
        .catch(err => console.warn('Price fetch failed for new asset:', err))
    }

    return asset
  }

  async updateAsset(id: string, userId: string, data: AssetUpdateInput) {
    const existing = await this.repo.findById(id, userId)
    if (!existing) throw new HTTPException(404, { message: 'Asset not found' })
    return this.repo.update(id, userId, {
      name: data.name, symbol: data.symbol ?? undefined, market: data.market ?? undefined,
      unit: normalizeAssetUnit({
        subKind: existing.subKind,
        currencyCode: existing.currencyCode,
        symbol: data.symbol === undefined ? existing.symbol : data.symbol ?? null,
        unit: data.unit === undefined ? existing.unit : data.unit ?? null,
      }),
      pricingMode: data.pricingMode ?? undefined,
    })
  }

  async deleteAsset(id: string, userId: string) {
    const existing = await this.repo.findById(id, userId)
    if (!existing) throw new HTTPException(404, { message: 'Asset not found' })
    return this.repo.delete(id, userId)
  }
}
