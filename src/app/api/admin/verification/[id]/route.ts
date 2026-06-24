// src/app/api/admin/verification/[id]/route.ts
import { NextRequest } from 'next/server'
import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { prisma, db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role } from '@prisma/client'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canViewVerification)
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params

    const verification = await db.doctorVerification.findUnique({
      where:   { id },
      include: {
        doctor: {
          include: {
            user: { select: { id: true, email: true, createdAt: true } },
          },
        },
        certificates: { orderBy: { createdAt: 'desc' } },
        queueEntry:   true,
      },
    })

    if (!verification) return ok({ error: true, message: 'الطلب غير موجود' })

    // تعيين الطلب لهذا المشرف إذا لم يكن معيناً
    if (verification.queueEntry && !verification.queueEntry.assignedTo) {
      await db.verificationQueue.update({
        where: { verificationId: id },
        data:  { assignedTo: auth.context.userId, status: 'IN_REVIEW' },
      })
    }

    return ok({
      id:                   verification.id,
      verificationStatus:   verification.verificationStatus,
      currentStage:         verification.currentStage,
      overallConfidence:    verification.overallConfidence,
      faceMatchConfidence:  verification.faceMatchConfidence,
      faceMatchStatus:      verification.faceVerificationStatus,
      selfieImageUrl:       verification.selfieImageUrl,
      idImageUrl:           verification.idImageUrl,
      rejectionReason:      verification.rejectionReason,
      uploadAttempts:       verification.uploadAttempts,
      createdAt:            verification.createdAt,
      doctor: {
        id:              verification.doctor.id,
        firstName:       verification.doctor.firstName,
        lastName:        verification.doctor.lastName,
        specialization:  verification.doctor.specialization,
        licenseNumber:   verification.doctor.licenseNumber,
        city:            verification.doctor.city,
        email:           verification.doctor.user.email,
        memberSince:     verification.doctor.user.createdAt,
      },
      certificates: verification.certificates.map((c: any) => ({
        id:                  c.id,
        imageUrl:            c.imageUrl,
        status:              c.status,
        aiConfidence:        c.aiConfidence,
        aiNotes:             c.aiNotes,
        extractedName:       c.extractedName,
        extractedSpecialty:  c.extractedSpecialty,
        extractedIssueDate:  c.extractedIssueDate,
        extractedExpiryDate: c.extractedExpiryDate,
        extractedIssuer:     c.extractedIssuer,
        nameMatchScore:      c.nameMatchScore,
        nameMatchStatus:     c.nameMatchStatus,
        humanStatus:         c.humanStatus,
        humanNotes:          c.humanNotes,
      })),
      queueEntry: verification.queueEntry,
    })
  } catch (err) {
    console.error('[GET /api/admin/verification/[id]]', err)
    return serverError()
  }
}
