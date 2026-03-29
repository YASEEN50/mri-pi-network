// =============================================================================
// src/lib/validations/auth.schema.ts
// =============================================================================

import { z } from 'zod'
import { Role } from '@prisma/client'

export const RegisterSchema = z.object({
  email: z.string().email('بريد إلكتروني غير صالح').toLowerCase(),
  password: z
    .string()
    .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    .regex(/[A-Z]/, 'يجب أن تحتوي على حرف كبير')
    .regex(/[0-9]/, 'يجب أن تحتوي على رقم'),
  role: z.enum([Role.CLIENT, Role.DOCTOR, Role.FACILITY]),
})

export const LoginSchema = z.object({
  email: z.string().email('بريد إلكتروني غير صالح').toLowerCase(),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
})

export const PiLoginSchema = z.object({
  accessToken: z.string().min(1, 'Pi access token مطلوب'),
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput    = z.infer<typeof LoginSchema>
export type PiLoginInput  = z.infer<typeof PiLoginSchema>
