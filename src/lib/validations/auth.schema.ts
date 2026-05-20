// src/lib/validations/auth.schema.ts
import { z } from 'zod'

// نستخدم string literals بدل import من @prisma/client
// لتجنب dependency على prisma generate في وقت التطوير
const REGISTERABLE_ROLES = ['CLIENT', 'DOCTOR', 'FACILITY'] as const
export type RegisterableRole = typeof REGISTERABLE_ROLES[number]

export const RegisterSchema = z.object({
  email: z.string().email('بريد إلكتروني غير صالح').toLowerCase(),
  password: z
    .string()
    .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    .regex(/[A-Z]/, 'يجب أن تحتوي على حرف كبير')
    .regex(/[0-9]/, 'يجب أن تحتوي على رقم'),
  role: z.enum(REGISTERABLE_ROLES),
})

export const LoginSchema = z.object({
  email:    z.string().email('بريد إلكتروني غير صالح').toLowerCase(),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
})

export const PiLoginSchema = z.object({
  accessToken: z.string().min(1, 'Pi access token مطلوب'),
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput    = z.infer<typeof LoginSchema>
export type PiLoginInput  = z.infer<typeof PiLoginSchema>
