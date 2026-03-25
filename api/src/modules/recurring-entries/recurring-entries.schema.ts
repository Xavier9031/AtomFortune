import { z } from 'zod'

export const RecurringEntryCreateSchema = z.object({
  assetId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  type: z.enum(['income', 'expense']),
  amount: z.number().nonnegative(),
  quantity: z.number().positive().optional(),
  currencyCode: z.string().default('TWD'),
  dayOfMonth: z.number().int().min(1).max(31).default(1),
  label: z.string().optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const RecurringEntryUpdateSchema = RecurringEntryCreateSchema.partial()
