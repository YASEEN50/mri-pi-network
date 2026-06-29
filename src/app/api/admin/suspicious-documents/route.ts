// GET — مستندات مشبوهة (forensics + علامات احتيال)

import { NextRequest } from 'next/server'
import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'

const DOC_TYPE_LABELS: Record<string, string> = {
  CREDENTIAL:  'شهادة جامعية',
  LICENSE:     'رخصة مزاولة',
  DATAFLOW:    'Dataflow',
  ID_DOCUMENT: 'هوية',
  SELFIE:      'سيلفي',
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canViewVerification)
    if (!auth.success) return fromAppError(auth.error)

    const page       = Number(req.nextUrl.searchParams.get('page')  ?? 1)
    const limit      = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 30), 100)
    const minScore   = Number(req.nextUrl.searchParams.get('minScore') ?? 40)
    const docType    = req.nextUrl.searchParams.get('docType') ?? undefined
    const skip       = (page - 1) * limit

    const where: {
      OR: Array<Record<string, unknown>>
      docType?: string
    } = {
      OR: [
        { forensicsScore: { gte: minScore } },
        { isFlagged: true, forensicsScore: { not: null } },
      ],
      ...(docType && { docType }),
    }

    const [documents, total, stats] = await Promise.all([
      db.verificationDocument.findMany({
        where,
        orderBy: [{ forensicsScore: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          sessionId: true,
          doctorId: true,
          docType: true,
          subType: true,
          legalName: true,
          mimeType: true,
          fileSizeBytes: true,
          isFlagged: true,
          flagReason: true,
          forensicsScore: true,
          forensicsSignals: true,
          storageKey: true,
          createdAt: true,
          session: {
            select: {
              currentState: true,
              doctor: {
                select: { firstName: true, lastName: true, specialization: true },
              },
            },
          },
        },
      }),
      db.verificationDocument.count({ where }),
      db.verificationDocument.groupBy({
        by: ['docType'],
        where: { forensicsScore: { gte: minScore } },
        _count: { _all: true },
        orderBy: { _count: { _all: 'desc' } },
      }).catch(() => []),
    ])

    return ok({
      documents: documents.map((d: (typeof documents)[number]) => ({
        id:              d.id,
        sessionId:       d.sessionId,
        doctorId:        d.doctorId,
        docType:         d.docType,
        docTypeLabel:    DOC_TYPE_LABELS[d.docType] ?? d.docType,
        subType:         d.subType,
        legalName:       d.legalName,
        mimeType:        d.mimeType,
        sizeKb:          Math.round(d.fileSizeBytes / 1024),
        isFlagged:       d.isFlagged,
        flagReason:      d.flagReason,
        forensicsScore:  d.forensicsScore,
        forensicsSignals: d.forensicsSignals,
        url:             `/api/files/${d.storageKey.split('/').map(encodeURIComponent).join('/')}`,
        createdAt:       d.createdAt,
        sessionState:    d.session?.currentState,
        doctorName:      d.session?.doctor
          ? `${d.session.doctor.firstName} ${d.session.doctor.lastName}`.trim()
          : null,
        specialization:    d.session?.doctor?.specialization ?? null,
      })),
      stats: stats.map((s: (typeof stats)[number]) => ({
        docType: s.docType,
        count:   s._count._all,
      })),
    }, { total, page, limit })
  } catch (err) {
    console.error('[GET /api/admin/suspicious-documents]', err)
    return serverError()
  }
}
