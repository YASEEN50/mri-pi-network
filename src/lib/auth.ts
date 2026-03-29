// =============================================================================
// src/lib/auth.ts
// NextAuth configuration — Credentials + Pi Network
// =============================================================================

import { NextAuthOptions, Session, User } from 'next-auth'
import { JWT } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { Role, ApprovalStatus } from '@prisma/client'

// =============================================================================
// Types
// =============================================================================

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
    }
  }

  interface User {
    id: string
    role: Role
    approvalStatus?: ApprovalStatus | null
    piUid?: string | null
    piUsername?: string | null
    isProfileComplete: boolean
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
  }
}

// =============================================================================
// Helpers
// =============================================================================

async function getProfileCompleteness(userId: string, role: Role): Promise<boolean> {
  switch (role) {
    case Role.CLIENT:
      return !!(await prisma.clientProfile.findUnique({ where: { userId } }))
    case Role.DOCTOR:
      return !!(await prisma.doctorProfile.findUnique({ where: { userId } }))
    case Role.FACILITY:
      return !!(await prisma.facilityProfile.findUnique({ where: { userId } }))
    default:
      return true
  }
}

async function getApprovalStatus(userId: string, role: Role): Promise<ApprovalStatus | null> {
  if (role === Role.DOCTOR) {
    const profile = await prisma.doctorProfile.findUnique({
      where: { userId },
      select: { approvalStatus: true },
    })
    return profile?.approvalStatus ?? null
  }
  if (role === Role.FACILITY) {
    const profile = await prisma.facilityProfile.findUnique({
      where: { userId },
      select: { approvalStatus: true },
    })
    return profile?.approvalStatus ?? null
  }
  return null
}

// =============================================================================
// NextAuth Options
// =============================================================================

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 days
  pages: {
    signIn: '/login',
    error: '/login',
    newUser: '/select-role',
  },

  providers: [
    // -------------------------------------------------------------------------
    // 1. Email / Password
    // -------------------------------------------------------------------------
    CredentialsProvider({
      id: 'credentials',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('MISSING_CREDENTIALS')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email, deletedAt: null },
        })

        if (!user || !user.passwordHash) {
          throw new Error('INVALID_CREDENTIALS')
        }

        if (!user.isActive) {
          throw new Error('ACCOUNT_DISABLED')
        }

        const isValid = await compare(credentials.password, user.passwordHash)
        if (!isValid) {
          throw new Error('INVALID_CREDENTIALS')
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
        }
      },
    }),

    // -------------------------------------------------------------------------
    // 2. Pi Network (Custom Provider)
    // -------------------------------------------------------------------------
    CredentialsProvider({
      id: 'pi-network',
      name: 'Pi Network',
      credentials: {
        accessToken: { label: 'Pi Access Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.accessToken) {
          throw new Error('MISSING_PI_TOKEN')
        }

        // Verify token with Pi Platform API
        const piUser = await verifyPiToken(credentials.accessToken)

        if (!piUser) {
          throw new Error('INVALID_PI_TOKEN')
        }

        // Upsert user — Pi users may or may not exist
        const user = await prisma.user.upsert({
          where: { piUid: piUser.uid },
          update: {
            piUsername: piUser.username,
            updatedAt: new Date(),
          },
          create: {
            piUid: piUser.uid,
            piUsername: piUser.username,
            role: Role.CLIENT, // سيتم تحديثه في صفحة select-role
            isActive: true,
          },
        })

        const isProfileComplete = await getProfileCompleteness(user.id, user.role)
        const approvalStatus = await getApprovalStatus(user.id, user.role)

        return {
          id: user.id,
          email: user.email,
          name: piUser.username,
          role: user.role,
          approvalStatus,
          piUid: user.piUid,
          piUsername: user.piUsername,
          isProfileComplete,
        }
      },
    }),
  ],

  callbacks: {
    // -------------------------------------------------------------------------
    // JWT Callback — يُشغَّل عند كل sign-in وعند تحديث الـ token
    // -------------------------------------------------------------------------
    async jwt({ token, user, trigger, session }) {
      // عند تسجيل الدخول: أضف البيانات من user object
      if (user) {
        token.id = user.id
        token.role = user.role
        token.approvalStatus = user.approvalStatus
        token.piUid = user.piUid ?? undefined
        token.piUsername = user.piUsername ?? undefined
        token.isProfileComplete = user.isProfileComplete
      }

      // عند تحديث الـ session (مثلاً بعد اكتمال الـ profile)
      if (trigger === 'update' && session) {
        if (session.role) token.role = session.role
        if (session.approvalStatus !== undefined) token.approvalStatus = session.approvalStatus
        if (session.isProfileComplete !== undefined) token.isProfileComplete = session.isProfileComplete
      }

      return token
    },

    // -------------------------------------------------------------------------
    // Session Callback — يُشغَّل عند كل طلب session
    // -------------------------------------------------------------------------
    async session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      session.user.approvalStatus = token.approvalStatus
      session.user.piUid = token.piUid
      session.user.piUsername = token.piUsername
      session.user.isProfileComplete = token.isProfileComplete
      return session
    },
  },
}

// =============================================================================
// Pi Network Token Verification
// =============================================================================

interface PiUser {
  uid: string
  username: string
}

async function verifyPiToken(accessToken: string): Promise<PiUser | null> {
  try {
    const response = await fetch('https://api.minepi.com/v2/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) return null

    const data = await response.json()
    return { uid: data.uid, username: data.username }
  } catch {
    return null
  }
}
