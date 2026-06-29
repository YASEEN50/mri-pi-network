// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth'
import { JWT } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { Role, ApprovalStatus } from '@prisma/client'
import { verifyPiAccessToken } from '@/lib/pi/verify-access-token'
import { resolvePiLoginUser } from '@/lib/auth/account-linking'
import { findUserByAuthEmail } from '@/lib/auth/find-user-by-email'
import { normalizeAuthEmail } from '@/lib/auth/normalize-email'
import { consumeMfaSignInToken } from '@/lib/mfa/signin-token'
import { resolveMfaSessionFlags } from '@/lib/mfa/session-flags'
import { getApprovalStatus, getProfileCompleteness } from '@/lib/auth/session-helpers'
import { isCrossSiteAuthCookieMode } from '@/lib/auth/cookie-options'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email?: string | null
      name?: string | null
      role: Role
      approvalStatus?: ApprovalStatus | null
      piUid?: string | null
      piUsername?: string | null
      isProfileComplete: boolean
      mfaEnabled?: boolean
      mfaVerified?: boolean
    }
  }
  interface User {
    id: string
    role: Role
    approvalStatus?: ApprovalStatus | null
    piUid?: string | null
    piUsername?: string | null
    isProfileComplete: boolean
    viaMfaToken?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: Role
    approvalStatus?: ApprovalStatus | null
    piUid?: string | null
    piUsername?: string | null
    isProfileComplete: boolean
    mfaEnabled?: boolean
    mfaVerified?: boolean
  }
}

async function applyMfaFlagsToToken(token: JWT, userId: string, role: Role, viaMfaToken: boolean) {
  const mfaEnabled = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true },
  }).then((u) => u?.mfaEnabled ?? false)

  const flags = resolveMfaSessionFlags({
    role,
    mfaEnabled,
    viaMfaToken,
  })
  token.mfaEnabled = flags.mfaEnabled
  token.mfaVerified = flags.mfaVerified
}

/** Pi Browser embeds apps in a cross-site iframe — default SameSite=Lax cookies are not stored. */
const crossSiteCookiesEnabled = isCrossSiteAuthCookieMode()

function crossSiteAuthCookies(): NextAuthOptions['cookies'] {
  const partitioned = process.env.NEXTAUTH_COOKIE_PARTITIONED !== 'false'
  const opts = {
    sameSite: 'none' as const,
    path: '/',
    secure: true,
    ...(partitioned ? { partitioned: true as const } : {}),
  }
  const httpOnly = { httpOnly: true, ...opts }
  return {
    sessionToken: {
      name: '__Secure-next-auth.session-token',
      options: httpOnly,
    },
    callbackUrl: {
      name: '__Secure-next-auth.callback-url',
      options: httpOnly,
    },
    csrfToken: {
      name: '__Secure-next-auth.csrf-token',
      options: httpOnly,
    },
    pkceCodeVerifier: {
      name: '__Secure-next-auth.pkce.code_verifier',
      options: httpOnly,
    },
    state: {
      name: '__Secure-next-auth.state',
      options: httpOnly,
    },
    nonce: {
      name: '__Secure-next-auth.nonce',
      options: httpOnly,
    },
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login', error: '/login', newUser: '/select-role' },
  useSecureCookies: process.env.NODE_ENV === 'production' || crossSiteCookiesEnabled,
  ...(crossSiteCookiesEnabled ? { cookies: crossSiteAuthCookies() } : {}),

  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) throw new Error('MISSING_CREDENTIALS')
        const email = normalizeAuthEmail(credentials.email)
        const user = await findUserByAuthEmail(email, {
          id: true,
          email: true,
          passwordHash: true,
          isActive: true,
          role: true,
          piUid: true,
          piUsername: true,
          mfaEnabled: true,
        })
        if (!user || !user.passwordHash) throw new Error('INVALID_CREDENTIALS')
        if (!user.isActive) throw new Error('ACCOUNT_DISABLED')
        const isValid = await compare(credentials.password, user.passwordHash)
        if (!isValid) throw new Error('INVALID_CREDENTIALS')
        if ((user.role === Role.ADMIN || user.role === Role.OWNER) && user.mfaEnabled) {
          throw new Error('MFA_REQUIRED')
        }
        const isProfileComplete = await getProfileCompleteness(user.id, user.role)
        const approvalStatus = await getApprovalStatus(user.id, user.role)
        return {
          id: user.id,
          email: user.email,
          name: null,
          role: user.role,
          approvalStatus,
          piUid: user.piUid,
          piUsername: user.piUsername,
          isProfileComplete,
          viaMfaToken: false,
        }
      },
    }),

    CredentialsProvider({
      id: 'pi-network',
      name: 'Pi Network',
      credentials: { accessToken: { label: 'Pi Access Token', type: 'text' } },
      async authorize(credentials) {
        if (!credentials?.accessToken) throw new Error('MISSING_PI_TOKEN')
        const piUser = await verifyPiAccessToken(credentials.accessToken)
        if (!piUser) throw new Error('INVALID_PI_TOKEN')
        const user = await resolvePiLoginUser(piUser)
        if (!user.isActive) throw new Error('ACCOUNT_DISABLED')
        if ((user.role === Role.ADMIN || user.role === Role.OWNER) && user.mfaEnabled) {
          throw new Error('MFA_USE_EMAIL')
        }
        const isProfileComplete = await getProfileCompleteness(user.id, user.role)
        const approvalStatus = await getApprovalStatus(user.id, user.role)
        return {
          id: user.id,
          email: user.email,
          name: user.piUsername ?? piUser.username,
          role: user.role,
          approvalStatus,
          piUid: user.piUid,
          piUsername: user.piUsername,
          isProfileComplete,
          viaMfaToken: false,
        }
      },
    }),

    CredentialsProvider({
      id: 'mfa-token',
      name: 'MFA Token',
      credentials: {
        token: { type: 'text' },
        userId: { type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.token || !credentials?.userId) throw new Error('INVALID_MFA_TOKEN')
        const consumed = await consumeMfaSignInToken(credentials.userId, credentials.token)
        if (!consumed) throw new Error('INVALID_MFA_TOKEN')

        const user = await prisma.user.findFirst({
          where: { id: credentials.userId, deletedAt: null, mfaEnabled: true },
          select: {
            id: true,
            email: true,
            role: true,
            piUid: true,
            piUsername: true,
            isActive: true,
          },
        })
        if (!user?.isActive) throw new Error('INVALID_MFA_TOKEN')

        const isProfileComplete = await getProfileCompleteness(user.id, user.role)
        const approvalStatus = await getApprovalStatus(user.id, user.role)
        return {
          id: user.id,
          email: user.email,
          name: null,
          role: user.role,
          approvalStatus,
          piUid: user.piUid,
          piUsername: user.piUsername,
          isProfileComplete,
          viaMfaToken: true,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.approvalStatus = user.approvalStatus
        token.piUid = user.piUid ?? undefined
        token.piUsername = user.piUsername ?? undefined
        token.isProfileComplete = user.isProfileComplete
        if (user.email) (token as { email?: string }).email = user.email
        await applyMfaFlagsToToken(
          token,
          user.id,
          user.role,
          (user as { viaMfaToken?: boolean }).viaMfaToken === true,
        )
      }
      if (trigger === 'update' && session) {
        if (session.role) token.role = session.role
        if (session.approvalStatus !== undefined) token.approvalStatus = session.approvalStatus
        if (session.isProfileComplete !== undefined) token.isProfileComplete = session.isProfileComplete
        const mfaSession = session as {
          mfaVerified?: boolean
          mfaEnabled?: boolean
          refreshProfile?: boolean
        }
        if (mfaSession.mfaVerified !== undefined) token.mfaVerified = mfaSession.mfaVerified
        if (mfaSession.mfaEnabled !== undefined) token.mfaEnabled = mfaSession.mfaEnabled
        if (mfaSession.refreshProfile && token.id) {
          const dbUser = await prisma.user.findFirst({
            where: { id: token.id as string, deletedAt: null },
            select: { email: true, piUid: true, piUsername: true, role: true },
          })
          if (dbUser) {
            token.piUid = dbUser.piUid ?? undefined
            token.piUsername = dbUser.piUsername ?? undefined
            if (dbUser.email) (token as { email?: string }).email = dbUser.email
          }
        }
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      session.user.approvalStatus = token.approvalStatus
      session.user.piUid = token.piUid
      session.user.piUsername = token.piUsername
      session.user.isProfileComplete = token.isProfileComplete
      session.user.mfaEnabled = token.mfaEnabled
      session.user.mfaVerified = token.mfaVerified
      if ((token as { email?: string }).email) {
        session.user.email = (token as { email?: string }).email
      }
      return session
    },
  },
}

