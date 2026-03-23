import { z } from 'zod'

export const AccountCreateSchema = z.object({
  name: z.string().min(1),
  institution: z.string().nullable().optional(),
  accountType: z.enum(['bank', 'broker', 'crypto_exchange', 'e_wallet', 'cash', 'other']),
  note: z.string().nullable().optional(),
  initialBalance: z.number().optional(),
  currencyCode: z.string().optional(),
})

export const AccountUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  institution: z.string().nullable().optional(),
  accountType: z.enum(['bank', 'broker', 'crypto_exchange', 'e_wallet', 'cash', 'other']).optional(),
  note: z.string().nullable().optional(),
})

export const BalanceSetSchema = z.object({
  balance: z.number(),
  currencyCode: z.string().optional().default('TWD'),
})

export type AccountCreateInput = z.infer<typeof AccountCreateSchema>
export type AccountUpdateInput = z.infer<typeof AccountUpdateSchema>
export type BalanceSetInput = z.infer<typeof BalanceSetSchema>
