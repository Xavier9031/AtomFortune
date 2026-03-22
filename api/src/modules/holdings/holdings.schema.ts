import { z } from 'zod'
export const HoldingUpsertSchema = z.object({
  quantity: z.number().min(0),
})
export type HoldingUpsertInput = z.infer<typeof HoldingUpsertSchema>
