import { HoldingsRepository } from './holdings.repository'
import { AssetsRepository } from '../assets/assets.repository'
import { AccountsRepository } from '../accounts/accounts.repository'
import { HoldingUpsertInput } from './holdings.schema'
import { HTTPException } from 'hono/http-exception'

export class HoldingsService {
  constructor(
    private repo: HoldingsRepository,
    private assetsRepo: AssetsRepository,
    private accountsRepo: AccountsRepository,
  ) {}

  findAll(accountId?: string) { return this.repo.findAll(accountId) }

  async upsert(assetId: string, accountId: string, data: HoldingUpsertInput) {
    const asset = await this.assetsRepo.findById(assetId)
    if (!asset) throw new HTTPException(404, { message: 'Asset not found' })
    const account = await this.accountsRepo.findById(accountId)
    if (!account) throw new HTTPException(404, { message: 'Account not found' })
    return this.repo.upsert(assetId, accountId, String(data.quantity))
  }

  async delete(assetId: string, accountId: string) {
    const existing = await this.repo.findOne(assetId, accountId)
    if (!existing) throw new HTTPException(404, { message: 'Holding not found' })
    return this.repo.delete(assetId, accountId)
  }
}
