// src/lib/prisma.ts
// Prisma Client Singleton — بعد تشغيل `prisma generate` تختفي الـ (as any) casts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// ─── db: typed alias يشمل كل الـ models بعد prisma generate ─────────────────
// بعد `npx prisma generate` هذه الـ types تُولَّد تلقائياً
// إلى ذلك الحين نستخدم هذا الـ alias لتجنب (prisma as any) في كل مكان
export type DbClient = typeof prisma & {
  jobTracking:          any
  verificationSession:  any
  verificationDocument: any
  verificationScore:    any
  faceVerification:     any
  ocrResult:            any
  fraudReference:       any
  fraudCheck:           any
  auditLog:             any
  idempotencyKey:       any
  systemConfig:         any
  doctorVerification:   any
  doctorCertificate:    any
  verificationQueue:    any
  contentReport:        any
  adminTask:            any
  adminPermission:      any
  chatRoom:             any
  chatMessage:          any
  appointmentReminder:  any
  medicalRecord:        any
  adminProfile:         any
  fraudEvent:           any
  iPReputation:         any
  deviceFingerprint:    any
  deviceUser:           any
}

export const db = prisma as unknown as DbClient
