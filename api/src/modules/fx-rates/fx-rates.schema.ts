import { z } from 'zod'
export const FxRateManualCreateSchema = z.object({
  fromCurrency: z.string().min(3).max(10),
  toCurrency: z.string().min(3).max(10),
  rateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rate: z.number().positive(),
})
export type FxRateManualCreateInput = z.infer<typeof FxRateManualCreateSchema>
