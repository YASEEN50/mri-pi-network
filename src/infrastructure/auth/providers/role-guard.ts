import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Role, ApprovalStatus } from '@prisma/client'
import { UnauthorizedError } from '@/core/errors'

export interface GuardOptions {
  roles?: Role[]
  requireApproved?: boolean
}

export interface AuthContext {
  userId: string
  role: Role
  approvalStatus?: ApprovalStatus | null
  piUid?: string | null
}

type AuthSuccess = { success: true; context: AuthContext }
type AuthFailure = { success: false; error: UnauthorizedError }

export async function requireAuth(
  options: GuardOptions = {}
): Promise<AuthSuccess | AuthFailure> {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return { success: false, error: new UnauthorizedError('يجب تسجيل الدخول أولاً') }
  }

  const { role, id: userId, approvalStatus, piUid } = session.user

  if (options.roles && !options.roles.includes(role)) {
    return { success: false, error: new UnauthorizedError('ليس لديك صلاحية للوصول لهذه الخدمة') }
  }

  if (options.requireApproved && approvalStatus !== ApprovalStatus.APPROVED) {
    return { success: false, error: new UnauthorizedError('حسابك لا يزال قيد المراجعة') }
  }

  return {
    success: true,
    context: { userId, role, approvalStatus, piUid },
  }
}
