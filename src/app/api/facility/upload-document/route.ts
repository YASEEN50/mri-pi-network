// src/app/api/facility/upload-document/route.ts
// رفع مستندات المنشأة: أوراق الملكية + التصريح الرسمي

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma } from '@/lib/prisma'
import { fromAppError, serverError } from '@/lib/api-response'
import { validateFileBuffer } from '@/lib/verification/file-validator'
import { Role, ApprovalStatus } from '@prisma/client'
import { StorageError } from '@/core/errors'
import { productionStorageBlockedMessage, saveUploadedFile } from '@/lib/storage/production-storage'
import { resolveStoredDocUrl } from '@/lib/storage/local-file-url'
import type { AllowedMimeType } from '@/core/interfaces/services/file-storage.interface'

export const runtime = 'nodejs'
export const maxDuration = 30

const DOC_TYPES = {
  OWNERSHIP: 'OWNERSHIP',
  LICENSE:   'LICENSE',
} as const

type FacilityDocType = typeof DOC_TYPES[keyof typeof DOC_TYPES]

function hasStoredDoc(url: string | null | undefined): boolean {
  return Boolean(resolveStoredDocUrl(url))
}

export async function GET() {
  try {
    const auth = await requireAuth({ roles: [Role.FACILITY] })
    if (!auth.success) return fromAppError(auth.error)

    const facility = await prisma.facilityProfile.findUnique({
      where: { userId: auth.context.userId },
      select: {
        ownershipDocUrl: true,
        licenseDocUrl: true,
        approvalStatus: true,
      },
    })
    if (!facility) {
      return NextResponse.json({ error: true, message: 'ملف المنشأة غير موجود' }, { status: 404 })
    }

    const hasOwnership = hasStoredDoc(facility.ownershipDocUrl)
    const hasLicense = hasStoredDoc(facility.licenseDocUrl)
    const readyForReview = hasOwnership && hasLicense

    return NextResponse.json({
      success: true,
      hasOwnership,
      hasLicense,
      readyForReview,
      approvalStatus: facility.approvalStatus,
    })
  } catch (err) {
    console.error('[GET /api/facility/upload-document]', err)
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.FACILITY] })
    if (!auth.success) return fromAppError(auth.error)

    const storageBlocked = productionStorageBlockedMessage()
    if (storageBlocked) {
      return NextResponse.json({ error: true, message: storageBlocked }, { status: 503 })
    }

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
    if (!validation.valid || !validation.mimeType) {
      return NextResponse.json({ error: true, message: validation.error ?? 'نوع الملف غير مقبول' }, { status: 400 })
    }

    const publicUrl = await saveUploadedFile(buffer, {
      folder: 'facility-docs',
      mimeType: validation.mimeType as AllowedMimeType,
      filename: `${facility.id}-${docType.toLowerCase()}`,
      maxSizeBytes: 10 * 1024 * 1024,
    })

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

    const savedUrl =
      docType === DOC_TYPES.OWNERSHIP ? updated.ownershipDocUrl : updated.licenseDocUrl
    if (savedUrl !== publicUrl) {
      console.error('[POST /api/facility/upload-document] DB mismatch', {
        facilityId: facility.id,
        docType,
        expected: publicUrl,
        actual: savedUrl,
      })
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DB_SAVE_FAILED',
            message: 'تم رفع الملف لكن فشل حفظه في قاعدة البيانات — تواصل مع الدعم',
          },
        },
        { status: 500 },
      )
    }

    const hasBoth =
      hasStoredDoc(updated.ownershipDocUrl) && hasStoredDoc(updated.licenseDocUrl)
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
    if (err instanceof StorageError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: 500 },
      )
    }
    const prismaCode =
      err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : ''
    if (prismaCode === 'P2022') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SCHEMA_OUTDATED',
            message: 'قاعدة البيانات تحتاج تحديث — شغّل prisma migrate deploy على السيرفر',
          },
        },
        { status: 503 },
      )
    }
    return serverError()
  }
}
