// src/lib/medical-records/audit.ts

import { createHmac, randomUUID } from 'crypto'
import { db } from '@/lib/prisma'
import { requireEnv } from '@/lib/env'

export type MedicalRecordAuditAction =
  | 'MEDICAL_RECORD_LIST'
  | 'MEDICAL_RECORD_VIEW'
  | 'MEDICAL_RECORD_FILE_VIEW'
  | 'MEDICAL_RECORD_CREATE'
  | 'MEDICAL_RECORD_UPDATE'
  | 'MEDICAL_RECORD_DELETE'
  | 'MEDICAL_RECORD_SHARE'
  | 'MEDICAL_RECORD_UNSHARE'

export async function writeMedicalRecordAudit(params: {
  actorId: string
  actorRole: string
  action: MedicalRecordAuditAction
  recordId: string
  payload?: Record<string, unknown>
  ip?: string | null
  userAgent?: string | null
}): Promise<void> {
  try {
    const secret = requireEnv('AUDIT_LOG_SECRET')
    const timestamp = new Date()
    const id = randomUUID()
    const hmac = createHmac('sha256', secret)
      .update([id, params.actorId, params.action, params.recordId, timestamp.toISOString()].join('|'))
      .digest('hex')

    await db.auditLog.create({
      data: {
        id,
        actorId: params.actorId,
        actorRole: params.actorRole,
        action: params.action,
        targetType: 'MedicalRecord',
        targetId: params.recordId,
        payload: params.payload ?? {},
        ipAddress: params.ip ?? undefined,
        userAgent: params.userAgent ?? undefined,
        hmacSignature: hmac,
        createdAt: timestamp,
      },
    })
  } catch (err) {
    console.error('[medical-record audit]', err)
  }
}
