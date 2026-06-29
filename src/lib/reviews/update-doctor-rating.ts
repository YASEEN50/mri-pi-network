import { prisma } from '@/lib/prisma'

export async function refreshDoctorRatingStats(doctorId: string) {
  const stats = await prisma.review.aggregate({
    where: { doctorId, isVisible: true },
    _avg: { rating: true },
    _count: { rating: true },
  })
  await prisma.doctorProfile.update({
    where: { id: doctorId },
    data: {
      averageRating: stats._avg.rating ?? 0,
      totalReviews: stats._count.rating,
    },
  })
}
