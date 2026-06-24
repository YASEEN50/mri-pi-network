import { Role } from '@prisma/client'

export function requiresMfaRole(role: Role): boolean {
  return role === Role.ADMIN || role === Role.OWNER
}

export function resolveMfaSessionFlags(input: {
  role: Role
  mfaEnabled: boolean
  viaMfaToken: boolean
}): { mfaEnabled: boolean; mfaVerified: boolean } {
  if (!requiresMfaRole(input.role)) {
    return { mfaEnabled: false, mfaVerified: true }
  }
  if (!input.mfaEnabled) {
    return { mfaEnabled: false, mfaVerified: false }
  }
  return { mfaEnabled: true, mfaVerified: input.viaMfaToken }
}
