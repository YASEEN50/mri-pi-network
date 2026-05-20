import { compare, hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export interface EmailAuthResult {
  userId: string
  email: string
  isValid: boolean
  reason?: 'INVALID_CREDENTIALS' | 'ACCOUNT_DISABLED' | 'NOT_FOUND'
}

export class EmailAuthProvider {
  async verify(email: string, password: string): Promise<EmailAuthResult> {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), deletedAt: null },
    })
    if (!user || !user.passwordHash) {
      return { userId: '', email, isValid: false, reason: 'NOT_FOUND' }
    }
    if (!user.isActive) {
      return { userId: user.id, email, isValid: false, reason: 'ACCOUNT_DISABLED' }
    }
    const isValid = await compare(password, user.passwordHash)
    if (!isValid) {
      return { userId: user.id, email, isValid: false, reason: 'INVALID_CREDENTIALS' }
    }
    return { userId: user.id, email, isValid: true }
  }

  async hashPassword(password: string): Promise<string> {
    return hash(password, 12)
  }
}
