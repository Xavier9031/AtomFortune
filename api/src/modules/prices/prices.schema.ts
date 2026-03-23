import { z } from 'zod'
export const PriceManualCreateSchema = z.object({
  assetId: z.string().uuid(),
  priceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  price: z.number().min(0),
})
export type PriceManualCreateInput = z.infer<typeof PriceManualCreateSchema>
