import { z } from 'zod'

export const UserCreateSchema = z.object({
  name: z.string().min(1).max(100),
})

export const UserUpdateSchema = z.object({
  name: z.string().min(1).max(100),
})

export type UserCreateInput = z.infer<typeof UserCreateSchema>
export type UserUpdateInput = z.infer<typeof UserUpdateSchema>
