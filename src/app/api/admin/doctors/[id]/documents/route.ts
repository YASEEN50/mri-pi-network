// src/app/api/admin/doctors/[id]/documents/route.ts
import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { NotFoundError } from '@/core/errors'
import { prisma } from '@/lib/prisma'
import { localFileUrl, isPlaceholderUrl } from '@/lib/storage/local-file-url'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth({ roles: [Role.ADMIN, Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params

    const doctor = await prisma.doctorProfile.findFirst({
      where: { id, deletedAt: null },
      include: {
        credentials: true,
        verificationSessions: {
          where: { isActive: true },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          include: {
            documents: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
    })

    if (!doctor) return fromAppError(new NotFoundError('الطبيب غير موجود'))

    const session = doctor.verificationSessions[0]
    const v2Docs = session?.documents ?? []

    const licenseDoc = v2Docs.find(d => d.docType === 'LICENSE')
    const licenseUrl = licenseDoc
      ? localFileUrl(licenseDoc.storageKey)
      : !isPlaceholderUrl(doctor.licenseImageUrl)
        ? doctor.licenseImageUrl
        : null

    const credentialDocs = v2Docs.filter(d => d.docType === 'CREDENTIAL')
    const credentials = doctor.credentials.map((cred, i) => {
      const v2 = credentialDocs[i]
      const url = v2
        ? localFileUrl(v2.storageKey)
        : !isPlaceholderUrl(cred.documentUrl)
          ? cred.documentUrl
          : null
      return {
        id: cred.id,
        title: cred.title,
        institution: cred.institution,
        country: cred.country,
        year: cred.year,
        isVerified: cred.isVerified,
        documentUrl: url,
        mimeType: v2?.mimeType ?? null,
      }
    })

    const otherDocuments = v2Docs
      .filter(d => !['LICENSE', 'CREDENTIAL'].includes(d.docType))
      .map(d => ({
        id: d.id,
        docType: d.docType,
        url: localFileUrl(d.storageKey),
        mimeType: d.mimeType,
        isProcessed: d.isProcessed,
      }))

    return ok({
      doctorId: doctor.id,
      sessionId: session?.id ?? null,
      license: licenseDoc
        ? {
            id: licenseDoc.id,
            url: licenseUrl,
            mimeType: licenseDoc.mimeType,
            isProcessed: licenseDoc.isProcessed,
          }
        : licenseUrl
          ? { id: null, url: licenseUrl, mimeType: null, isProcessed: false }
          : null,
      credentials,
      otherDocuments,
    })
  } catch (err) {
    console.error('[GET /api/admin/doctors/[id]/documents]', err)
    return serverError()
  }
}
