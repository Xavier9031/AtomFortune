import { z } from 'zod'

export const AssetCreateSchema = z.object({
  name: z.string().min(1),
  assetClass: z.enum(['asset', 'liability']),
  category: z.enum(['liquid', 'investment', 'fixed', 'receivable', 'debt']),
  subKind: z.string().min(1),
  symbol: z.string().optional(),
  market: z.string().optional(),
  currencyCode: z.string().length(3),
  pricingMode: z.enum(['market', 'fixed', 'manual']),
  unit: z.string().optional(),
})

export const AssetUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  symbol: z.string().optional(),
  market: z.string().optional(),
  unit: z.string().optional(),
})

export type AssetCreateInput = z.infer<typeof AssetCreateSchema>
export type AssetUpdateInput = z.infer<typeof AssetUpdateSchema>
