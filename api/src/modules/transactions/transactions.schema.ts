import { z } from 'zod'

export const TransactionCreateSchema = z.object({
  assetId: z.string().uuid(),
  accountId: z.string().uuid(),
  txnType: z.enum(['buy', 'sell', 'transfer_in', 'transfer_out', 'adjustment']),
  quantity: z.number(),
  txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
})

export const TransactionPatchSchema = z.object({
  note: z.string().optional(),
})

export type TransactionCreateInput = z.infer<typeof TransactionCreateSchema>
export type TransactionPatchInput = z.infer<typeof TransactionPatchSchema>
