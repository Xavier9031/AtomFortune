import { AccountsRepository } from './accounts.repository'
import { AccountCreateInput, AccountUpdateInput, BalanceSetInput } from './accounts.schema'
import { AssetsRepository } from '../assets/assets.repository'
import { HoldingsRepository } from '../holdings/holdings.repository'
import { HTTPException } from 'hono/http-exception'

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
    private holdingsRepo: HoldingsRepository,
  ) {}

  findAll() { return this.accountRepo.findAll() }
  findById(id: string) { return this.accountRepo.findById(id) }

  async createAccount(data: AccountCreateInput) {
    const account = await this.accountRepo.create({
      name: data.name, institution: data.institution ?? null,
      accountType: data.accountType, note: data.note ?? null,
    })
    if (data.initialBalance !== undefined) {
      await this.setBalance(account.id, data.initialBalance, data.currencyCode ?? 'TWD')
    }
    return account
  }

  async updateAccount(id: string, data: AccountUpdateInput) {
    const existing = await this.accountRepo.findById(id)
    if (!existing) throw new HTTPException(404, { message: 'Account not found' })
    return this.accountRepo.update(id, {
      name: data.name, institution: data.institution,
      accountType: data.accountType, note: data.note,
    })
  }

  async deleteAccount(id: string) {
    const existing = await this.accountRepo.findById(id)
    if (!existing) throw new HTTPException(404, { message: 'Account not found' })
    const hasHoldings = await this.accountRepo.hasHoldings(id)
    if (hasHoldings) throw new HTTPException(409, { message: 'Account has existing holdings' })
    return this.accountRepo.delete(id)
  }

  async setBalance(accountId: string, balance: number, currencyCode = 'TWD') {
    const account = await this.accountRepo.findById(accountId)
    if (!account) throw new HTTPException(404, { message: 'Account not found' })
    const subKind = LIQUID_SUBKINDS[account.accountType]
    if (!subKind) throw new HTTPException(400, { message: 'Account type does not support direct balance' })

    let asset = await this.assetRepo.findBySubKindAndCurrency(subKind, currencyCode)
    if (!asset) {
      const label = LIQUID_SUBKIND_LABELS[subKind] ?? '活存'
      asset = await this.assetRepo.create({
        name: `${label}（${currencyCode}）`,
        assetClass: 'asset',
        category: 'liquid',
        subKind,
        currencyCode,
        unit: currencyCode,
        pricingMode: 'fixed',
      })
    }
    return this.holdingsRepo.upsert(asset.id, accountId, balance.toString())
  }
}
