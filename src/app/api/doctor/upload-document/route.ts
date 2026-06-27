// src/app/api/doctor/upload-document/route.ts
// رفع وثيقة تحقق واحدة (شهادة، dataflow، هوية، سيلفي)

import { NextRequest, NextResponse } from 'next/server'
import { requireDoctorProfile } from '@/lib/doctor/require-doctor-profile'
import { prisma, db } from '@/lib/prisma'
import { fromAppError, serverError } from '@/lib/api-response'
import { validateFileBuffer } from '@/lib/verification/file-validator'
import { collectIntelligence } from '@/lib/fraud-intelligence'
import { requireEnv } from '@/lib/env'
import {
  DOC_TYPES,
  DEGREE_TYPES,
  type DegreeType,
} from '@/lib/verification/document-types'
import { randomUUID, createHash } from 'crypto'
import {
  productionStorageBlockedMessage,
  saveBufferByKey,
} from '@/lib/storage/production-storage'
import type { AllowedMimeType } from '@/core/interfaces/services/file-storage.interface'

export const runtime = 'nodejs'
export const maxDuration = 30

const FOLDER_MAP: Record<string, string> = {
  [DOC_TYPES.CREDENTIAL]:  'credential',
  [DOC_TYPES.DATAFLOW]:    'dataflow',
  [DOC_TYPES.ID_DOCUMENT]: 'id-doc',
  [DOC_TYPES.SELFIE]:      'selfie',
}

type DocSummary = { docType: string; legalName: string | null; subType: string | null }

export async function POST(req: NextRequest) {
  try {
    const auth = await requireDoctorProfile()
    if (!auth.success) return fromAppError(auth.error)

    const storageBlocked = productionStorageBlockedMessage()
    if (storageBlocked) {
      return NextResponse.json({ error: true, message: storageBlocked }, { status: 503 })
    }

    const { userId, doctorId, firstName, lastName } = auth
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    const deviceId = req.headers.get('x-device-id') ?? 'unknown'

    const doctor = { id: doctorId, firstName, lastName }
    const formData = await req.formData().catch(() => null)
    if (!formData) {
      return NextResponse.json({ error: true, message: 'يجب رفع الملف كـ multipart' }, { status: 400 })
    }

    const docType = String(formData.get('docType') ?? '')
    const subType = formData.get('subType') ? String(formData.get('subType')) : null
    const legalName = formData.get('legalName') ? String(formData.get('legalName')).trim() : null
    const file = formData.get('file') as File | null

const UPLOAD_DOC_TYPES = [DOC_TYPES.CREDENTIAL, DOC_TYPES.DATAFLOW, DOC_TYPES.ID_DOCUMENT, DOC_TYPES.SELFIE] as const

    if (!UPLOAD_DOC_TYPES.includes(docType as typeof UPLOAD_DOC_TYPES[number])) {
      return NextResponse.json({ error: true, message: 'نوع الوثيقة غير صالح' }, { status: 400 })
    }
    if (docType === DOC_TYPES.LICENSE) {
      return NextResponse.json({ error: true, message: 'استخدم /api/doctor/upload-license لشهادة المزاولة' }, { status: 400 })
    }
    if (docType === DOC_TYPES.CREDENTIAL) {
      if (!subType || !Object.values(DEGREE_TYPES).includes(subType as DegreeType)) {
        return NextResponse.json({ error: true, message: 'اختر نوع الشهادة (بكالوريوس / ماجستير / زمالة)' }, { status: 400 })
      }
      if (!legalName || legalName.length < 3) {
        return NextResponse.json({ error: true, message: 'أدخل الاسم كما يظهر في الشهادة' }, { status: 400 })
      }
    }
    if (docType === DOC_TYPES.ID_DOCUMENT) {
      if (!legalName || legalName.length < 3) {
        return NextResponse.json({ error: true, message: 'أدخل الاسم كما يظهر في الهوية' }, { status: 400 })
      }
    }
    if (!file) {
      return NextResponse.json({ error: true, message: 'لم يُرفع أي ملف' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const validation = validateFileBuffer(buffer)
    if (!validation.valid) {
      return NextResponse.json({ error: true, message: validation.error }, { status: 400 })
    }

    let session = await db.verificationSession.findFirst({
      where: { doctorId: doctor.id, isActive: true },
      include: { documents: { select: { docType: true, legalName: true, subType: true } } },
    })

    if (!session) {
      session = await db.verificationSession.create({
        data: {
          doctorId: doctor.id,
          userId,
          currentState: 'UNVERIFIED',
          isActive: true,
        },
        include: { documents: { select: { docType: true, legalName: true, subType: true } } },
      })
    }

    const existing = session.documents.filter((d: DocSummary) => d.docType === docType)
    if (existing.length > 0) {
      return NextResponse.json({ error: true, message: 'تم رفع هذه الوثيقة مسبقاً' }, { status: 409 })
    }

    const docs = session.documents as DocSummary[]

    if (docType === DOC_TYPES.DATAFLOW) {
      if (!docs.some(d => d.docType === DOC_TYPES.CREDENTIAL)) {
        return NextResponse.json({ error: true, message: 'ارفع الشهادة الجامعية أولاً' }, { status: 400 })
      }
      if (!docs.some(d => d.docType === DOC_TYPES.LICENSE)) {
        return NextResponse.json({ error: true, message: 'ارفع شهادة مزاولة المهنة أولاً' }, { status: 400 })
      }
    }

    if (docType === DOC_TYPES.ID_DOCUMENT) {
      if (!docs.some(d => d.docType === DOC_TYPES.DATAFLOW)) {
        return NextResponse.json({ error: true, message: 'ارفع نتيجة Dataflow أولاً' }, { status: 400 })
      }
      const degreeDoc = docs.find(d => d.docType === DOC_TYPES.CREDENTIAL)
      if (!degreeDoc?.legalName) {
        return NextResponse.json({ error: true, message: 'ارفع الشهادة الجامعية أولاً' }, { status: 400 })
      }
      const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
      if (normalize(legalName!) !== normalize(degreeDoc.legalName)) {
        return NextResponse.json({
          error: true,
          message: 'الاسم في الهوية يجب أن يطابق الاسم في الشهادة الجامعية',
        }, { status: 400 })
      }
    }

    if (docType === DOC_TYPES.SELFIE) {
      if (!docs.some(d => d.docType === DOC_TYPES.ID_DOCUMENT)) {
        return NextResponse.json({ error: true, message: 'ارفع الهوية أولاً' }, { status: 400 })
      }
    }

    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'application/pdf': '.pdf' }[validation.mimeType!] ?? ''
    const folder = FOLDER_MAP[docType] ?? 'misc'
    const storageKey = `${folder}/${randomUUID()}${ext}`
    const sha256 = createHash('sha256').update(buffer).digest('hex')
    const stored = await saveBufferByKey(
      buffer,
      storageKey,
      validation.mimeType! as AllowedMimeType,
    )

    const document = await db.verificationDocument.create({
      data: {
        sessionId: session.id,
        doctorId: doctor.id,
        docType,
        subType: subType ?? undefined,
        legalName: legalName ?? undefined,
        title: subType ?? undefined,
        storageKey,
        storageBucket: stored.bucket,
        mimeType: validation.mimeType!,
        fileSizeBytes: buffer.length,
        sha256Hash: sha256,
        isProcessed: docType === DOC_TYPES.DATAFLOW || docType === DOC_TYPES.CREDENTIAL,
      },
    })

    if (docType === DOC_TYPES.SELFIE) {
      const idDoc = await db.verificationDocument.findFirst({
        where: { sessionId: session.id, docType: DOC_TYPES.ID_DOCUMENT },
      })
      if (idDoc) {
        await db.verificationSession.update({
          where: { id: session.id },
          data: { currentState: 'FACE_SUBMITTED', updatedAt: new Date() },
        })

        const jobId = randomUUID()
        await db.jobTracking.create({
          data: {
            id: jobId,
            sessionId: session.id,
            doctorId: doctor.id,
            jobType: 'face-comparison',
            status: 'pending',
            idempotencyKey: `face-${session.id}`,
            attempts: 0,
            maxAttempts: 3,
          },
        })

        const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
        fetch(`${appUrl}/api/workers/face`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-worker-secret': requireEnv('WORKER_SECRET'),
          },
          body: JSON.stringify({
            jobId,
            sessionId: session.id,
            doctorId: doctor.id,
            selfieDocId: document.id,
            idDocId: idDoc.id,
            selfieKey: storageKey,
            idKey: idDoc.storageKey,
          }),
        }).catch(err => console.error('[upload-document] face worker failed:', err))
      }
    }

    collectIntelligence(
      { userId, sessionId: session.id, ipAddress: ip, deviceId },
      { isDuplicateHash: false, isSimilarImage: false },
    ).catch(() => {})

    return NextResponse.json({
      success: true,
      documentId: document.id,
      docType,
      message: 'تم رفع الوثيقة بنجاح',
    }, { status: 201 })
  } catch (err) {
    console.error('[upload-document]', err)
    return serverError()
  }
}
