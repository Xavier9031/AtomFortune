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

  findAll(userId: string, accountId?: string) { return this.repo.findAll(userId, accountId) }

  async upsert(userId: string, assetId: string, accountId: string, data: HoldingUpsertInput) {
    const asset = await this.assetsRepo.findById(assetId, userId)
    if (!asset) throw new HTTPException(404, { message: 'Asset not found' })
    const account = await this.accountsRepo.findById(accountId, userId)
    if (!account) throw new HTTPException(404, { message: 'Account not found' })
    return this.repo.upsert(userId, assetId, accountId, String(data.quantity))
  }

  async delete(userId: string, assetId: string, accountId: string) {
    const existing = await this.repo.findOne(userId, assetId, accountId)
    if (!existing) throw new HTTPException(404, { message: 'Holding not found' })
    return this.repo.delete(userId, assetId, accountId)
  }
}
