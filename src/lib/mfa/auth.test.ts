import { describe, it, expect } from 'vitest'
import { Role } from '@prisma/client'
import { requiresMfaRole, resolveMfaSessionFlags } from '@/lib/mfa/session-flags'
import { createMfaChallengeToken, verifyMfaChallengeToken } from '@/lib/mfa/challenge-token'

describe('MFA session flags', () => {
  it('requiresMfaRole for admin and owner only', () => {
    expect(requiresMfaRole(Role.ADMIN)).toBe(true)
    expect(requiresMfaRole(Role.OWNER)).toBe(true)
    expect(requiresMfaRole(Role.CLIENT)).toBe(false)
  })

  it('non-privileged users skip MFA', () => {
    expect(
      resolveMfaSessionFlags({ role: Role.CLIENT, mfaEnabled: false, viaMfaToken: false }),
    ).toEqual({ mfaEnabled: false, mfaVerified: true })
  })

  it('admin with MFA enabled needs viaMfaToken', () => {
    expect(
      resolveMfaSessionFlags({ role: Role.ADMIN, mfaEnabled: true, viaMfaToken: false }),
    ).toEqual({ mfaEnabled: true, mfaVerified: false })
    expect(
      resolveMfaSessionFlags({ role: Role.ADMIN, mfaEnabled: true, viaMfaToken: true }),
    ).toEqual({ mfaEnabled: true, mfaVerified: true })
  })
})

describe('MFA challenge token', () => {
  it('round-trips userId within TTL', () => {
    const token = createMfaChallengeToken('user-abc')
    expect(verifyMfaChallengeToken(token)).toEqual({ userId: 'user-abc' })
  })

  it('rejects tampered token', () => {
    const token = createMfaChallengeToken('user-abc')
    expect(verifyMfaChallengeToken(`${token}x`)).toBeNull()
  })
})
