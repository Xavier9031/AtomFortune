import { z } from 'zod'

export const AccountCreateSchema = z.object({
  name: z.string().min(1),
  institution: z.string().nullable().optional(),
  accountType: z.enum(['bank', 'broker', 'crypto_exchange', 'e_wallet', 'cash', 'other']),
  note: z.string().nullable().optional(),
})

export const AccountUpdateSchema = AccountCreateSchema.partial()
export type AccountCreateInput = z.infer<typeof AccountCreateSchema>
export type AccountUpdateInput = z.infer<typeof AccountUpdateSchema>
