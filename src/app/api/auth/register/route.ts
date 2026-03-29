// =============================================================================
// src/app/api/auth/register/route.ts
// =============================================================================

import { NextRequest } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/infrastructure/database/prisma/client'
import { created, fromAppError, parseBody, serverError } from '@/lib/api-response'
import { RegisterSchema } from '@/lib/validations/auth.schema'
import { ConflictError } from '@/core/errors'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = parseBody(RegisterSchema, body)
    if (!parsed.success) return parsed.response

    const { email, password, role } = parsed.data

    const exists = await prisma.user.findUnique({
      where: { email, deletedAt: null },
      select: { id: true },
    })
    if (exists) return fromAppError(new ConflictError('هذا البريد الإلكتروني مسجل مسبقاً'))

    const passwordHash = await hash(password, 12)
    const user = await prisma.user.create({
      data: { email, passwordHash, role },
      select: { id: true, email: true, role: true, createdAt: true },
    })

    return created({ user })
  } catch (err) {
    console.error('[POST /api/auth/register]', err)
    return serverError()
  }
}
