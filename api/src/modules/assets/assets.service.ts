import { AssetsRepository } from './assets.repository'
import { SnapshotItemsRepository } from '../snapshot-items/snapshot-items.repository'
import { AssetCreateInput, AssetUpdateInput } from './assets.schema'
import { HTTPException } from 'hono/http-exception'

const ASSET_CATEGORIES = ['liquid', 'investment', 'fixed', 'receivable'] as const
const LIABILITY_CATEGORIES = ['debt'] as const

export class AssetsService {
  constructor(
    private repo: AssetsRepository,
    private snapshotRepo: SnapshotItemsRepository,
  ) {}

  async findAll() { return this.repo.findAll() }
  async findById(id: string) { return this.repo.findById(id) }

  async createAsset(data: AssetCreateInput) {
    if (data.assetClass === 'asset' && !ASSET_CATEGORIES.includes(data.category as any))
      throw new HTTPException(422, { message: 'Invalid category for assetClass=asset' })
    if (data.assetClass === 'liability' && !LIABILITY_CATEGORIES.includes(data.category as any))
      throw new HTTPException(422, { message: 'category must be debt for liability' })
    return this.repo.create({
      name: data.name, assetClass: data.assetClass, category: data.category,
      subKind: data.subKind, symbol: data.symbol ?? null, market: data.market ?? null,
      currencyCode: data.currencyCode, pricingMode: data.pricingMode,
    })
  }

  async updateAsset(id: string, data: AssetUpdateInput) {
    const existing = await this.repo.findById(id)
    if (!existing) throw new HTTPException(404, { message: 'Asset not found' })
    return this.repo.update(id, {
      name: data.name, symbol: data.symbol ?? undefined, market: data.market ?? undefined,
    })
  }

  async deleteAsset(id: string) {
    const existing = await this.repo.findById(id)
    if (!existing) throw new HTTPException(404, { message: 'Asset not found' })
    return this.repo.delete(id)
  }
}
