import { prisma } from '@/lib/prisma'
import { PublicationStatus } from '@prisma/client'

export async function getHomePublications(limit = 8) {
  return prisma.publication.findMany({
    where: {
      deletedAt: null,
      status: PublicationStatus.PUBLISHED,
    },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: {
      doctor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          specialization: true,
          avatarUrl: true,
        },
      },
    },
  })
}

export type HomePublication = Awaited<ReturnType<typeof getHomePublications>>[number]
