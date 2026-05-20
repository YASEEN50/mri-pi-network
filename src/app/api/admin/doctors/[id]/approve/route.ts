import { NextRequest } from 'next/server'
import { Role, ApprovalStatus } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const ActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requireAuth({ roles: [Role.ADMIN, Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = ActionSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { action, notes } = parsed.data

    await prisma.doctorProfile.update({
      where: { id },
      data: {
        approvalStatus: action === 'approve' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
        approvedBy: auth.context.userId,
        approvedAt: action === 'approve' ? new Date() : undefined,
        approvalNotes: notes ?? null,
        updatedAt: new Date(),
      },
    })

    // إشعار للطبيب
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id }, select: { userId: true, firstName: true },
    })
    if (doctor) {
      await prisma.notification.create({
        data: {
          userId: doctor.userId,
          title:  action === 'approve' ? '🎉 تمت الموافقة على حسابك' : '❌ تم رفض طلبك',
          body:   action === 'approve'
            ? 'تهانينا! تم قبول ملفك الطبي. يمكنك الآن استقبال المواعيد.'
            : `تم رفض طلبك. ${notes ? 'السبب: ' + notes : ''}`,
          type:   action === 'approve' ? 'DOCTOR_APPROVED' : 'DOCTOR_REJECTED',
          data:   { notes },
        },
      }).catch(() => {})
    }

    return ok({ message: action === 'approve' ? 'تمت الموافقة بنجاح' : 'تم رفض الطلب' })
  } catch (err) {
    console.error('[approve doctor]', err)
    return serverError()
  }
}
