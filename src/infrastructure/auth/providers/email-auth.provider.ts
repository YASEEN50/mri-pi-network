// =============================================================================
// src/infrastructure/auth/providers/email-auth.provider.ts
// Email/Password authentication — used in NextAuth CredentialsProvider
// =============================================================================

import { compare, hash } from 'bcryptjs'
import { prisma } from '@/infrastructure/database/prisma/client'

export interface EmailAuthResult {
  userId: string
  email: string
  isValid: boolean
  reason?: 'INVALID_CREDENTIALS' | 'ACCOUNT_DISABLED' | 'NOT_FOUND'
}

export class EmailAuthProvider {
  async verify(email: string, password: string): Promise<EmailAuthResult> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim(), deletedAt: null },
    })

    if (!user || !user.passwordHash) {
      return { userId: '', email, isValid: false, reason: 'NOT_FOUND' }
    }

    if (!user.isActive) {
      return { userId: user.id, email, isValid: false, reason: 'ACCOUNT_DISABLED' }
    }

    const isMatch = await compare(password, user.passwordHash)
    if (!isMatch) {
      return { userId: user.id, email, isValid: false, reason: 'INVALID_CREDENTIALS' }
    }

    return { userId: user.id, email, isValid: true }
  }

  async hashPassword(password: string): Promise<string> {
    return hash(password, 12)
  }

  validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
    if (password.length < 8) return { valid: false, reason: 'كلمة المرور قصيرة جداً (8 أحرف على الأقل)' }
    if (!/[A-Z]/.test(password)) return { valid: false, reason: 'يجب أن تحتوي على حرف كبير واحد على الأقل' }
    if (!/[0-9]/.test(password)) return { valid: false, reason: 'يجب أن تحتوي على رقم واحد على الأقل' }
    return { valid: true }
  }
}

// =============================================================================
// src/infrastructure/auth/providers/pi-auth.provider.ts
// Pi Network auth provider — wraps PiAuthService for NextAuth
// =============================================================================

import { PiAuthService } from '@/infrastructure/pi-network/pi-auth.service'
import { Role } from '@prisma/client'

export interface PiProviderResult {
  id: string
  piUid: string
  piUsername: string
  role: Role
  isNewUser: boolean
  isProfileComplete: boolean
}

export class PiAuthProvider {
  private readonly piAuthService: PiAuthService

  constructor() {
    this.piAuthService = new PiAuthService()
  }

  async authenticate(accessToken: string): Promise<PiProviderResult | null> {
    const result = await this.piAuthService.authenticateWithAccessToken(accessToken)
    if (!result) return null

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      include: {
        clientProfile: true,
        doctorProfile: true,
        facilityProfile: true,
      },
    })

    if (!user) return null

    const isProfileComplete = !!(
      user.clientProfile || user.doctorProfile || user.facilityProfile
    )

    return {
      id: user.id,
      piUid: result.piUid,
      piUsername: result.piUsername,
      role: user.role,
      isNewUser: result.isNewUser,
      isProfileComplete,
    }
  }
}

// =============================================================================
// src/infrastructure/auth/middleware/role-guard.ts
// Server-side role guard — for use in API routes and Server Components
// =============================================================================

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Role, ApprovalStatus } from '@prisma/client'
import { UnauthorizedError, ForbiddenError } from '@/core/errors'

export interface GuardOptions {
  roles?: Role[]
  requireApproved?: boolean   // للأطباء والمنشآت
}

export interface AuthContext {
  userId: string
  role: Role
  approvalStatus?: ApprovalStatus | null
  piUid?: string | null
}

/**
 * استخدام في API Routes:
 *
 * const ctx = await requireAuth({ roles: [Role.ADMIN] })
 * if (!ctx.success) return NextResponse.json({ error: ctx.error.code }, { status: ctx.error.statusCode })
 */
export async function requireAuth(
  options: GuardOptions = {}
): Promise<{ success: true; context: AuthContext } | { success: false; error: UnauthorizedError | ForbiddenError }> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return { success: false, error: new UnauthorizedError('يجب تسجيل الدخول أولاً') }
  }

  const { roles, requireApproved } = options

  // التحقق من الدور
  if (roles && !roles.includes(session.user.role)) {
    return { success: false, error: new ForbiddenError('ليس لديك الصلاحية للوصول إلى هذا المورد') }
  }

  // التحقق من الموافقة
  if (requireApproved && session.user.approvalStatus !== ApprovalStatus.APPROVED) {
    return {
      success: false,
      error: new ForbiddenError('حسابك لم يُعتمد بعد، يرجى انتظار مراجعة الإدارة'),
    }
  }

  return {
    success: true,
    context: {
      userId: session.user.id,
      role: session.user.role,
      approvalStatus: session.user.approvalStatus,
      piUid: session.user.piUid,
    },
  }
}
