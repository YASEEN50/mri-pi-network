// src/app/api/profile/avatar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { fromAppError, ok, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { validateFileBuffer } from '@/lib/verification/file-validator'

export const runtime = 'nodejs'
export const maxDuration = 30

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png'])

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.CLIENT, Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const formData = await req.formData().catch(() => null)
    if (!formData) {
      return NextResponse.json({ error: true, message: 'يجب رفع الصورة كـ multipart' }, { status: 400 })
    }

    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: true, message: 'لم يُرفع أي ملف' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const validation = validateFileBuffer(buffer)
    if (!validation.valid || !validation.mimeType || !IMAGE_MIMES.has(validation.mimeType)) {
      return NextResponse.json(
        { error: true, message: validation.error ?? 'يُقبل فقط صور JPEG أو PNG' },
        { status: 400 },
      )
    }

    const ext = validation.mimeType === 'image/png' ? '.png' : '.jpg'
    const filename = `${auth.context.userId}-${randomUUID()}${ext}`
    const storageKey = `avatars/${filename}`

    await mkdir(join(process.cwd(), '.local-storage', 'avatars'), { recursive: true })
    await writeFile(join(process.cwd(), '.local-storage', storageKey), buffer)

    const avatarUrl = `/api/avatars/${encodeURIComponent(filename)}`

    if (auth.context.role === Role.CLIENT) {
      await prisma.clientProfile.upsert({
        where: { userId: auth.context.userId },
        update: { avatarUrl },
        create: {
          userId: auth.context.userId,
          firstName: 'مستخدم',
          lastName: '',
          avatarUrl,
          country: 'SA',
        },
      })
    } else {
      const profile = await prisma.doctorProfile.findUnique({
        where: { userId: auth.context.userId },
      })
      if (!profile) {
        return NextResponse.json({ error: true, message: 'ملف الطبيب غير موجود' }, { status: 404 })
      }
      await prisma.doctorProfile.update({
        where: { userId: auth.context.userId },
        data: { avatarUrl },
      })
    }

    return ok({ avatarUrl, message: 'تم رفع الصورة الشخصية' })
  } catch (err) {
    console.error('[POST /api/profile/avatar]', err)
    return serverError()
  }
}
