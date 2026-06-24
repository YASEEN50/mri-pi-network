import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeAuthEmail } from '@/lib/auth/normalize-email'

/** Case-insensitive email lookup for login and password flows. */
export async function findUserByAuthEmail<T extends Prisma.UserSelect>(
  email: string,
  select: T,
) {
  const normalized = normalizeAuthEmail(email)
  return prisma.user.findFirst({
    where: {
      deletedAt: null,
      email: { equals: normalized, mode: 'insensitive' },
    },
    select,
  })
}
