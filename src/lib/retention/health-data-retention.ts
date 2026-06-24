import { prisma } from '@/lib/prisma'
import { deleteMedicalRecordFile } from '@/lib/medical-records/storage'
import { HEALTH_RETENTION } from '@/lib/retention/config'

const BATCH = 100

function cutoffDays(days: number): Date {
  return new Date(Date.now() - days * 86_400_000)
}

/** Remove medical records soft-deleted longer than retention window */
export async function purgeSoftDeletedMedicalRecords(): Promise<number> {
  const cutoff = cutoffDays(HEALTH_RETENTION.softDeletedMedicalRecordsDays)
  let total = 0

  for (;;) {
    const rows = await prisma.medicalRecord.findMany({
      where: { deletedAt: { not: null, lt: cutoff } },
      take: BATCH,
      select: { id: true, fileType: true },
    })
    if (rows.length === 0) break

    for (const row of rows) {
      await deleteMedicalRecordFile(row.id, row.fileType).catch(() => {})
    }

    const deleted = await prisma.medicalRecord.deleteMany({
      where: { id: { in: rows.map(r => r.id) } },
    })
    total += deleted.count
    if (rows.length < BATCH) break
  }

  return total
}

/** Stop sharing when sharedUntil has passed */
export async function revokeExpiredMedicalShares(): Promise<number> {
  const now = new Date()
  const result = await prisma.medicalRecord.updateMany({
    where: {
      isShared: true,
      sharedUntil: { not: null, lt: now },
    },
    data: {
      isShared: false,
      sharedUntil: null,
    },
  })
  return result.count
}

/** Delete chat message bodies in closed/archived rooms past retention */
export async function purgeClosedChatMessages(): Promise<number> {
  const cutoff = cutoffDays(HEALTH_RETENTION.closedChatMessagesDays)
  let total = 0

  const rooms = await prisma.chatRoom.findMany({
    where: {
      status: { in: ['CLOSED', 'ARCHIVED'] },
      updatedAt: { lt: cutoff },
    },
    select: { id: true },
    take: BATCH,
  })

  if (rooms.length === 0) return 0

  for (const chunk of chunkIds(rooms.map(r => r.id), 50)) {
    const result = await prisma.chatMessage.deleteMany({
      where: { roomId: { in: chunk } },
    })
    total += result.count
  }

  return total
}

/** Purge old medical-record audit trail entries */
export async function purgeMedicalRecordAuditLogs(): Promise<number> {
  const cutoff = cutoffDays(HEALTH_RETENTION.medicalRecordAuditLogsDays)
  const result = await prisma.auditLog.deleteMany({
    where: {
      targetType: 'MedicalRecord',
      createdAt: { lt: cutoff },
    },
  })
  return result.count
}

export async function runHealthDataRetention(): Promise<{
  softDeletedMedicalRecords: number
  expiredSharesRevoked: number
  chatMessagesPurged: number
  auditLogsPurged: number
  ranAt: string
}> {
  const [softDeletedMedicalRecords, expiredSharesRevoked, chatMessagesPurged, auditLogsPurged] =
    await Promise.all([
      purgeSoftDeletedMedicalRecords(),
      revokeExpiredMedicalShares(),
      purgeClosedChatMessages(),
      purgeMedicalRecordAuditLogs(),
    ])

  return {
    softDeletedMedicalRecords,
    expiredSharesRevoked,
    chatMessagesPurged,
    auditLogsPurged,
    ranAt: new Date().toISOString(),
  }
}

function chunkIds(ids: string[], size: number): string[][] {
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size))
  }
  return out
}
