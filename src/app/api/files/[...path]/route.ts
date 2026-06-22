// src/app/api/files/[...path]/route.ts
// عرض الملفات المحلية (.local-storage) — للأدمن/المالك/الطبيب صاحب الملف

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { fromAppError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { isServeableStorageKey } from '@/lib/storage/local-file-url'

const MIME: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.pdf':  'application/pdf',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const auth = await requireAuth({
      roles: [Role.ADMIN, Role.OWNER, Role.DOCTOR, Role.FACILITY],
    })
    if (!auth.success) return fromAppError(auth.error)

    const { path } = await params
    const storageKey = path.map(decodeURIComponent).join('/')

    if (!isServeableStorageKey(storageKey) || storageKey.includes('..')) {
      return NextResponse.json({ error: true, message: 'مسار غير صالح' }, { status: 400 })
    }

    if (auth.context.role === Role.DOCTOR) {
      const profile = await prisma.doctorProfile.findUnique({
        where:  { userId: auth.context.userId },
        select: { id: true },
      })
      const doc = profile
        ? await prisma.verificationDocument.findFirst({
            where: { storageKey, doctorId: profile.id },
            select: { id: true },
          })
        : null
      if (!doc) {
        return NextResponse.json({ error: true, message: 'غير مصرح' }, { status: 403 })
      }
    }

    if (auth.context.role === Role.FACILITY) {
      const profile = await prisma.facilityProfile.findUnique({
        where: { userId: auth.context.userId },
        select: { licenseDocUrl: true, ownershipDocUrl: true },
      })
      const allowed = profile && (
        profile.licenseDocUrl?.includes(storageKey) ||
        profile.ownershipDocUrl?.includes(storageKey)
      )
      if (!allowed) {
        return NextResponse.json({ error: true, message: 'غير مصرح' }, { status: 403 })
      }
    }

    const ext = storageKey.slice(storageKey.lastIndexOf('.')).toLowerCase()
    const filePath = join(process.cwd(), '.local-storage', storageKey)
    const buffer = await readFile(filePath)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': MIME[ext] ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: true, message: 'الملف غير موجود' }, { status: 404 })
  }
}
