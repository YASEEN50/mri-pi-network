/** Health-data retention windows (days). Override via env: RETENTION_<KEY>_DAYS */

function daysFromEnv(key: string, fallback: number): number {
  const raw = process.env[`RETENTION_${key}_DAYS`]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
}

export const HEALTH_RETENTION = {
  /** Soft-deleted medical records → permanent purge */
  softDeletedMedicalRecordsDays: daysFromEnv('SOFT_DELETED_MEDICAL_RECORDS', 30),
  /** Chat messages in closed/archived rooms */
  closedChatMessagesDays: daysFromEnv('CLOSED_CHAT_MESSAGES', 90),
  /** Medical-record audit log entries */
  medicalRecordAuditLogsDays: daysFromEnv('MEDICAL_RECORD_AUDIT', 365),
} as const

export function retentionPolicySummary() {
  return {
    softDeletedMedicalRecordsDays: HEALTH_RETENTION.softDeletedMedicalRecordsDays,
    closedChatMessagesDays: HEALTH_RETENTION.closedChatMessagesDays,
    medicalRecordAuditLogsDays: HEALTH_RETENTION.medicalRecordAuditLogsDays,
    expiredShares: 'Revoked on each run when sharedUntil < now',
  }
}
