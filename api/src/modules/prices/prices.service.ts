import { PricesRepository } from './prices.repository'
import { AssetsRepository } from '../assets/assets.repository'
import { PriceManualCreateInput } from './prices.schema'
import { HTTPException } from 'hono/http-exception'

export class PricesService {
  constructor(private repo: PricesRepository, private assetsRepo: AssetsRepository) {}

  findAll(filters: { assetId?: string; from?: string; to?: string }) {
    return this.repo.findAll(filters)
  }

  async createManual(data: PriceManualCreateInput) {
    const asset = await this.assetsRepo.findById(data.assetId)
    if (!asset) throw new HTTPException(404, { message: 'Asset not found' })
    if (asset.pricingMode !== 'manual')
      throw new HTTPException(422, { message: 'Manual price entry only for pricingMode=manual assets' })
    return this.repo.upsert(data.assetId, data.priceDate, String(data.price), 'manual')
  }
}
