import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'
import { fromAppError, ok, serverError } from '@/lib/api-response'
import { requireFacilityProfile } from '@/lib/facility/require-facility-profile'
import { buildFacilityMediaUrl } from '@/lib/facility/profile-utils'
import { validateFileBuffer } from '@/lib/verification/file-validator'

export const runtime = 'nodejs'
export const maxDuration = 30

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png'])
const MEDIA_KINDS = ['logo', 'cover'] as const
type MediaKind = (typeof MEDIA_KINDS)[number]

export async function POST(req: NextRequest) {
  try {
    const auth = await requireFacilityProfile()
    if (!auth.success) return fromAppError(auth.error)

    const formData = await req.formData().catch(() => null)
    if (!formData) {
      return NextResponse.json({ error: true, message: 'يجب رفع الصورة كـ multipart' }, { status: 400 })
    }

    const kind = String(formData.get('kind') ?? '') as MediaKind
    const file = formData.get('file') as File | null

    if (!MEDIA_KINDS.includes(kind)) {
      return NextResponse.json({ error: true, message: 'نوع الصورة غير صالح (logo أو cover)' }, { status: 400 })
    }
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
    const storageKey = `facility-media/${auth.facilityId}-${kind}-${randomUUID()}${ext}`

    await mkdir(join(process.cwd(), '.local-storage', 'facility-media'), { recursive: true })
    await writeFile(join(process.cwd(), '.local-storage', storageKey), buffer)

    const publicUrl = buildFacilityMediaUrl(storageKey)
    const field = kind === 'logo' ? 'logoUrl' : 'coverUrl'

    await prisma.facilityProfile.update({
      where: { id: auth.facilityId },
      data: { [field]: publicUrl },
    })

    return ok({ kind, url: publicUrl, message: kind === 'logo' ? 'تم رفع الشعار' : 'تم رفع صورة الغلاف' })
  } catch (err) {
    console.error('[POST /api/facility/profile/media]', err)
    return serverError()
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireFacilityProfile()
    if (!auth.success) return fromAppError(auth.error)

    const kind = req.nextUrl.searchParams.get('kind') as MediaKind | null
    if (!kind || !MEDIA_KINDS.includes(kind)) {
      return ok({ error: true, message: 'نوع الصورة غير صالح' })
    }

    const field = kind === 'logo' ? 'logoUrl' : 'coverUrl'
    await prisma.facilityProfile.update({
      where: { id: auth.facilityId },
      data: { [field]: null },
    })

    return ok({ removed: true, kind })
  } catch (err) {
    console.error('[DELETE /api/facility/profile/media]', err)
    return serverError()
  }
}
