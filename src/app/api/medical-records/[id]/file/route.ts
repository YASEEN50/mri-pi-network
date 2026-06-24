// src/app/api/medical-records/[id]/file/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { db } from '@/lib/prisma'
import { fromAppError, serverError } from '@/lib/api-response'
import { canAccessMedicalRecord } from '@/lib/medical-records/access'
import { readMedicalRecordFile } from '@/lib/medical-records/storage'
import { writeMedicalRecordAudit } from '@/lib/medical-records/audit'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params
    const record = await db.medicalRecord.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        clientId: true,
        doctorId: true,
        isShared: true,
        sharedUntil: true,
        fileUrl: true,
        fileType: true,
      },
    })

    if (!record?.fileUrl) {
      return NextResponse.json({ error: true, message: 'لا يوجد ملف' }, { status: 404 })
    }

    const allowed = await canAccessMedicalRecord(auth.context, record)
    if (!allowed) {
      return NextResponse.json({ error: true, message: 'غير مصرح' }, { status: 403 })
    }

    const file = await readMedicalRecordFile(record.id, record.fileType)
    if (!file) {
      return NextResponse.json({ error: true, message: 'الملف غير موجود' }, { status: 404 })
    }

    await writeMedicalRecordAudit({
      actorId: auth.context.userId,
      actorRole: auth.context.role,
      action: 'MEDICAL_RECORD_FILE_VIEW',
      recordId: record.id,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
      userAgent: req.headers.get('user-agent'),
    })

    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        'Content-Type': file.contentType,
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `inline; filename="medical-record-${record.id}"`,
      },
    })
  } catch (err) {
    console.error('[GET /api/medical-records/[id]/file]', err)
    return serverError()
  }
}
