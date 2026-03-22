import { AccountsRepository } from './accounts.repository'
import { AccountCreateInput, AccountUpdateInput } from './accounts.schema'
import { HTTPException } from 'hono/http-exception'

export class AccountsService {
  constructor(private repo: AccountsRepository) {}

  findAll() { return this.repo.findAll() }
  findById(id: string) { return this.repo.findById(id) }

  createAccount(data: AccountCreateInput) {
    return this.repo.create({
      name: data.name, institution: data.institution ?? null,
      accountType: data.accountType, note: data.note ?? null,
    })
  }

  async updateAccount(id: string, data: AccountUpdateInput) {
    const existing = await this.repo.findById(id)
    if (!existing) throw new HTTPException(404, { message: 'Account not found' })
    return this.repo.update(id, {
      name: data.name, institution: data.institution,
      accountType: data.accountType, note: data.note,
    })
  }

  async deleteAccount(id: string) {
    const existing = await this.repo.findById(id)
    if (!existing) throw new HTTPException(404, { message: 'Account not found' })
    const hasHoldings = await this.repo.hasHoldings(id)
    if (hasHoldings) throw new HTTPException(409, { message: 'Account has existing holdings' })
    return this.repo.delete(id)
  }
}
