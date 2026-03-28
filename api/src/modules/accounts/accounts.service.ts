import { AccountsRepository } from './accounts.repository'
import { AccountCreateInput, AccountUpdateInput, BalanceSetInput } from './accounts.schema'
import { AssetsRepository } from '../assets/assets.repository'
import { HoldingsService } from '../holdings/holdings.service'
import { HTTPException } from 'hono/http-exception'
import { normalizeAssetUnit } from '../assets/asset-rules'

const LIQUID_SUBKINDS: Partial<Record<string, string>> = {
  bank: 'bank_account',
  cash: 'physical_cash',
  e_wallet: 'e_wallet',
}

const LIQUID_SUBKIND_LABELS: Record<string, string> = {
  bank_account: '活存',
  physical_cash: '現金',
  e_wallet: '電子錢包',
}

export class AccountsService {
  constructor(
    private accountRepo: AccountsRepository,
    private assetRepo: AssetsRepository,
    private holdingsService: HoldingsService,
  ) {}

  findAll(userId: string) { return this.accountRepo.findAll(userId) }

  async createAccount(userId: string, data: AccountCreateInput) {
    const account = await this.accountRepo.create({
      userId,
      name: data.name, institution: data.institution ?? null,
      accountType: data.accountType, note: data.note ?? null,
    })
    if (data.initialBalance !== undefined) {
      await this.setBalance(userId, account.id, data.initialBalance, data.currencyCode ?? 'TWD')
    }
    return account
  }

  async updateAccount(id: string, userId: string, data: AccountUpdateInput) {
    const existing = await this.accountRepo.findById(id, userId)
    if (!existing) throw new HTTPException(404, { message: 'Account not found' })
    return this.accountRepo.update(id, userId, {
      name: data.name, institution: data.institution,
      accountType: data.accountType, note: data.note,
    })
  }

  async deleteAccount(id: string, userId: string) {
    const existing = await this.accountRepo.findById(id, userId)
    if (!existing) throw new HTTPException(404, { message: 'Account not found' })
    const hasHoldings = await this.accountRepo.hasHoldings(id)
    if (hasHoldings) throw new HTTPException(409, { message: 'Account has existing holdings' })
    return this.accountRepo.delete(id, userId)
  }

  async setBalance(userId: string, accountId: string, balance: number, currencyCode = 'TWD') {
    const account = await this.accountRepo.findById(accountId, userId)
    if (!account) throw new HTTPException(404, { message: 'Account not found' })
    const subKind = LIQUID_SUBKINDS[account.accountType]
    if (!subKind) throw new HTTPException(400, { message: 'Account type does not support direct balance' })

    let asset = await this.assetRepo.findBySubKindAndCurrency(userId, subKind, currencyCode)
    if (!asset) {
      const label = LIQUID_SUBKIND_LABELS[subKind] ?? '活存'
      asset = await this.assetRepo.create({
        userId,
        name: `${label}（${currencyCode}）`,
        assetClass: 'asset',
        category: 'liquid',
        subKind,
        currencyCode,
        unit: normalizeAssetUnit({ subKind, currencyCode }),
        pricingMode: 'fixed',
      })
    }
    // Goes through HoldingsService which handles snapshot refresh
    return this.holdingsService.upsertDirect(userId, asset.id, accountId, balance.toString())
  }
}
