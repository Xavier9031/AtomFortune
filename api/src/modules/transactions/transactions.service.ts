import { TransactionsRepository } from './transactions.repository'
import { TransactionCreateInput, TransactionPatchInput } from './transactions.schema'
import { HTTPException } from 'hono/http-exception'

const ADJUSTMENT_TYPE = 'adjustment'
const POSITIVE_ONLY_TYPES = ['buy', 'sell', 'transfer_in', 'transfer_out']

export class TransactionsService {
  constructor(private repo: TransactionsRepository) {}

  findAll(userId: string, filters: { assetId?: string; accountId?: string; from?: string; to?: string }) {
    return this.repo.findAll(userId, filters)
  }

  async create(userId: string, data: TransactionCreateInput) {
    if (POSITIVE_ONLY_TYPES.includes(data.txnType) && data.quantity < 0)
      throw new HTTPException(422, { message: `quantity must be positive for txnType=${data.txnType}` })
    return this.repo.create({
      userId,
      assetId: data.assetId, accountId: data.accountId,
      txnType: data.txnType, quantity: String(data.quantity),
      txnDate: data.txnDate, note: data.note ?? null,
    })
  }

  async updateNote(id: string, userId: string, data: TransactionPatchInput) {
    const existing = await this.repo.findById(id, userId)
    if (!existing) throw new HTTPException(404, { message: 'Transaction not found' })
    return this.repo.updateNote(id, userId, data.note ?? null)
  }

  async delete(id: string, userId: string) {
    const existing = await this.repo.findById(id, userId)
    if (!existing) throw new HTTPException(404, { message: 'Transaction not found' })
    if (existing.txnType !== ADJUSTMENT_TYPE)
      throw new HTTPException(422, { message: 'Only adjustment transactions can be deleted' })
    return this.repo.delete(id, userId)
  }
}
