import { compare } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import { ForbiddenError, BusinessRuleError, UnauthorizedError } from '@/core/errors'
import { deleteMedicalRecordFile } from '@/lib/medical-records/storage'

export interface DeleteAccountInput {
  userId: string
  password?: string
  confirmPhrase: string
}

export async function deleteUserAccount(input: DeleteAccountInput): Promise<void> {
  const { userId, password, confirmPhrase } = input

  if (confirmPhrase !== 'DELETE') {
    throw new BusinessRuleError('اكتب DELETE للتأكيد')
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      role: true,
      email: true,
      passwordHash: true,
      clientProfile: { select: { id: true } },
      doctorProfile: { select: { id: true } },
      facilityProfile: { select: { id: true } },
    },
  })

  if (!user) throw new BusinessRuleError('الحساب غير موجود أو محذوف مسبقاً')

  if (user.role === Role.OWNER || user.role === Role.ADMIN) {
    throw new ForbiddenError('لا يمكن حذف حساب المالك أو الأدمن ذاتياً. تواصل مع الدعم.')
  }

  if (user.passwordHash) {
    if (!password) throw new UnauthorizedError('أدخل كلمة المرور لتأكيد الحذف')
    const valid = await compare(password, user.passwordHash)
    if (!valid) throw new UnauthorizedError('كلمة المرور غير صحيحة')
  }

  const now = new Date()
  const tombstoneEmail = `deleted+${userId}@deleted.mri.local`
  const tombstonePi = `deleted_${userId.slice(0, 8)}`

  await prisma.$transaction(async tx => {
    if (user.clientProfile) {
      const records = await tx.medicalRecord.findMany({
        where: { clientId: user.clientProfile.id, deletedAt: null },
        select: { id: true, fileType: true },
      })
      for (const rec of records) {
        await deleteMedicalRecordFile(rec.id, rec.fileType).catch(() => {})
      }
      await tx.medicalRecord.updateMany({
        where: { clientId: user.clientProfile.id },
        data: {
          deletedAt: now,
          title: '[deleted]',
          description: null,
          fileUrl: null,
        },
      })
      await tx.clientProfile.update({
        where: { id: user.clientProfile.id },
        data: {
          deletedAt: now,
          firstName: 'محذوف',
          lastName: 'محذوف',
          phone: null,
          avatarUrl: null,
          address: null,
          allergies: [],
          chronicDiseases: [],
        },
      })
    }

    if (user.doctorProfile) {
      await tx.chatMessage.updateMany({
        where: { senderId: userId },
        data: { content: '[deleted]', fileUrl: null, deletedAt: now },
      })
      await tx.doctorProfile.update({
        where: { id: user.doctorProfile.id },
        data: {
          deletedAt: now,
          firstName: 'محذوف',
          lastName: 'محذوف',
          bio: null,
          phone: null,
          avatarUrl: null,
          address: null,
        },
      })
    }

    if (user.facilityProfile) {
      await tx.facilityProfile.update({
        where: { id: user.facilityProfile.id },
        data: {
          deletedAt: now,
          name: 'منشأة محذوفة',
          description: null,
          logoUrl: null,
          coverUrl: null,
          phone: null,
          email: null,
          website: null,
        },
      })
    }

    await tx.notification.deleteMany({ where: { userId } })
    await tx.session.deleteMany({ where: { userId } })

    await tx.user.update({
      where: { id: userId },
      data: {
        deletedAt: now,
        isActive: false,
        email: user.email ? tombstoneEmail : null,
        phone: null,
        passwordHash: null,
        piUid: null,
        piUsername: tombstonePi,
        emailVerified: null,
      },
    })

    await tx.activityLog.create({
      data: {
        actorId: userId,
        action: 'DELETE_USER',
        targetType: 'USER',
        targetId: userId,
        details: { selfService: true, previousRole: user.role },
      },
    })
  })
}
