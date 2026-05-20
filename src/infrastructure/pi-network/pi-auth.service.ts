// =============================================================================
// src/infrastructure/pi-network/pi-auth.service.ts
// Pi authentication — used by NextAuth Pi provider
// =============================================================================

import { prisma } from '@/lib/prisma'
import { PiSdkService } from './pi-sdk.service'
import { Role } from '@prisma/client'

export interface PiAuthResult {
  userId: string
  piUid: string
  piUsername: string
  isNewUser: boolean
}

export class PiAuthService {
  private readonly piSdk: PiSdkService

  constructor() {
    this.piSdk = new PiSdkService()
  }

  async authenticateWithAccessToken(accessToken: string): Promise<PiAuthResult | null> {
    const isSandbox = process.env.PI_SANDBOX === 'true'

    // التحقق من التوكن
    const piUser = isSandbox
      ? await this.piSdk.verifySandboxToken(accessToken)
      : await this.piSdk.verifyAccessToken(accessToken)

    if (!piUser) return null

    // البحث عن المستخدم أو إنشاؤه
    let isNewUser = false
    let user = await prisma.user.findFirst({
      where: { piUid: piUser.uid, deletedAt: null },
    })

    if (!user) {
      isNewUser = true
      user = await prisma.user.create({
        data: {
          piUid: piUser.uid,
          piUsername: piUser.username,
          role: Role.CLIENT, // سيُحدَّث في select-role
          isActive: true,
        },
      })
    } else if (user.piUsername !== piUser.username) {
      // تحديث اسم المستخدم إذا تغيّر
      user = await prisma.user.update({
        where: { id: user.id },
        data: { piUsername: piUser.username },
      })
    }

    // تحديث KYC إذا كان متاحاً
    if (!isSandbox) {
      const kycStatus = await this.piSdk.getKYCStatus(piUser.uid)
      if (kycStatus.verified) {
        const doctorProfile = await prisma.doctorProfile.findUnique({
          where: { userId: user.id },
        })
        if (doctorProfile && !doctorProfile.piKycVerified) {
          await prisma.doctorProfile.update({
            where: { id: doctorProfile.id },
            data: { piKycVerified: true },
          })
        }
      }
    }

    return {
      userId: user.id,
      piUid: piUser.uid,
      piUsername: piUser.username,
      isNewUser,
    }
  }
}

// =============================================================================
// src/infrastructure/pi-network/pi-payments.interface.ts
// Pi Payments — Interface جاهز للتوسع المستقبلي
// =============================================================================

export type PaymentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ERROR'

export interface PiPaymentMetadata {
  appointmentId?: string
  userId?: string
  description?: string
  [key: string]: unknown
}

export interface CreatePiPaymentInput {
  amount: number                  // بـ Pi
  memo: string                    // وصف قصير
  metadata: PiPaymentMetadata
  uid: string                     // piUid للمستخدم
}

export interface PiPaymentResult {
  paymentId: string
  txid?: string
  status: PaymentStatus
  amount: number
  createdAt: Date
}

/**
 * IPiPaymentService
 * Interface للدفع بـ Pi Network — سيُنفَّذ في قسم لاحق
 */
export interface IPiPaymentService {
  /**
   * إنشاء دفعة جديدة
   */
  createPayment(input: CreatePiPaymentInput): Promise<PiPaymentResult>

  /**
   * الموافقة على دفعة معلقة (server-side approval)
   */
  approvePayment(paymentId: string): Promise<void>

  /**
   * إتمام الدفعة بعد تأكيد Blockchain
   */
  completePayment(paymentId: string, txid: string): Promise<PiPaymentResult>

  /**
   * التحقق من حالة دفعة
   */
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>

  /**
   * التعامل مع دفعات ناقصة (incomplete payments)
   */
  handleIncompletePayment(paymentId: string): Promise<void>
}
