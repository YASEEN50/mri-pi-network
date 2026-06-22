// src/app/api/facility/upload-document/route.ts
// رفع مستندات المنشأة: أوراق الملكية + التصريح الرسمي

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma } from '@/lib/prisma'
import { fromAppError, serverError } from '@/lib/api-response'
import { validateFileBuffer } from '@/lib/verification/file-validator'
import { Role, ApprovalStatus } from '@prisma/client'
import { randomUUID } from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export const runtime = 'nodejs'
export const maxDuration = 30

const DOC_TYPES = {
  OWNERSHIP: 'OWNERSHIP',
  LICENSE:   'LICENSE',
} as const

type FacilityDocType = typeof DOC_TYPES[keyof typeof DOC_TYPES]

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.FACILITY] })
    if (!auth.success) return fromAppError(auth.error)

    const facility = await prisma.facilityProfile.findUnique({
      where: { userId: auth.context.userId },
    })
    if (!facility) {
      return NextResponse.json({ error: true, message: 'ملف المنشأة غير موجود' }, { status: 404 })
    }
    if (facility.approvalStatus === ApprovalStatus.APPROVED) {
      return NextResponse.json({ error: true, message: 'المنشأة معتمدة مسبقاً' }, { status: 400 })
    }

    const formData = await req.formData().catch(() => null)
    if (!formData) {
      return NextResponse.json({ error: true, message: 'يجب رفع الملف كـ multipart' }, { status: 400 })
    }

    const docType = String(formData.get('docType') ?? '') as FacilityDocType
    const file = formData.get('file') as File | null

    if (!Object.values(DOC_TYPES).includes(docType)) {
      return NextResponse.json({ error: true, message: 'نوع المستند غير صالح' }, { status: 400 })
    }
    if (!file) {
      return NextResponse.json({ error: true, message: 'لم يُرفع أي ملف' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const validation = validateFileBuffer(buffer)
    if (!validation.valid) {
      return NextResponse.json({ error: true, message: validation.error }, { status: 400 })
    }

    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'application/pdf': '.pdf' }[validation.mimeType!] ?? ''
    const storageKey = `facility-docs/${randomUUID()}${ext}`

    await mkdir(join(process.cwd(), '.local-storage', 'facility-docs'), { recursive: true })
    await writeFile(join(process.cwd(), '.local-storage', storageKey), buffer)

    const publicUrl = `/api/files/${storageKey.split('/').map(encodeURIComponent).join('/')}`

    const updateData: { ownershipDocUrl?: string; licenseDocUrl?: string } = {}
    if (docType === DOC_TYPES.OWNERSHIP) {
      updateData.ownershipDocUrl = publicUrl
    } else {
      updateData.licenseDocUrl = publicUrl
    }

    const updated = await prisma.facilityProfile.update({
      where: { id: facility.id },
      data: updateData,
      select: { ownershipDocUrl: true, licenseDocUrl: true },
    })

    const hasBoth = Boolean(
      updated.ownershipDocUrl?.trim() &&
      updated.licenseDocUrl?.trim() &&
      !updated.licenseDocUrl.includes('placeholder'),
    )
    if (hasBoth) {
      await prisma.facilityProfile.update({
        where: { id: facility.id },
        data: { approvalStatus: ApprovalStatus.DOCUMENTS_REVIEW },
      })
    }

    return NextResponse.json({
      success: true,
      docType,
      url: publicUrl,
      message: 'تم رفع المستند بنجاح',
      readyForReview: hasBoth,
    }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/facility/upload-document]', err)
    return serverError()
  }
}
