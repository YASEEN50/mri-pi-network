// src/app/api/search/route.ts
// بحث موحد في الأطباء والمنشآت والمنشورات
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'
import { PublicationStatus, ApprovalStatus } from '@prisma/client'
import { buildDoctorTextSearch } from '@/lib/doctors/search-text'
import { doctorProfilePublicWhere, expireStalePremios } from '@/lib/premio/active-premio'
import { attachPremioTiers } from '@/lib/premio/list-doctors'
import { sortByPremioTier } from '@/lib/premio/tiers'

export async function GET(req: NextRequest) {
  try {
    const q      = req.nextUrl.searchParams.get('q') ?? ''
    const filter = req.nextUrl.searchParams.get('filter') ?? 'all' // all | doctors | facilities | publications
    const city   = req.nextUrl.searchParams.get('city') ?? ''
    const limit  = Number(req.nextUrl.searchParams.get('limit') ?? 5)

    if (q.length < 2) return ok({ doctors: [], facilities: [], publications: [] })

    await expireStalePremios()

    const doctorSearchWhere = doctorProfilePublicWhere({
      ...buildDoctorTextSearch(q),
      ...(city && { city: { contains: city, mode: 'insensitive' as const } }),
    })

    const [doctors, facilities, publications] = await Promise.all([
      filter === 'all' || filter === 'doctors'
        ? attachPremioTiers(
            await prisma.doctorProfile.findMany({
              where: doctorSearchWhere,
              take: limit * 3,
              select: {
                id: true, userId: true, firstName: true, lastName: true,
                specialization: true, city: true, avatarUrl: true,
                averageRating: true, totalReviews: true, consultationFee: true,
              },
            }),
          ).then(sorted => sortByPremioTier(sorted).slice(0, limit))
        : Promise.resolve([]),

      filter === 'all' || filter === 'facilities'
        ? prisma.facilityProfile.findMany({
            where: {
              OR: [
                { name:        { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
              approvalStatus: ApprovalStatus.APPROVED,
              deletedAt:      null,
              ...(city && { city: { contains: city, mode: 'insensitive' } }),
            },
            take: limit,
            select: { id: true, name: true, type: true, city: true, logoUrl: true, averageRating: true },
          })
        : Promise.resolve([]),

      filter === 'all' || filter === 'publications'
        ? prisma.publication.findMany({
            where: {
              OR: [
                { title:   { contains: q, mode: 'insensitive' } },
                { summary: { contains: q, mode: 'insensitive' } },
                { tags:    { has: q } },
              ],
              status:    PublicationStatus.PUBLISHED,
              deletedAt: null,
            },
            take: limit,
            include: {
              doctor: { select: { firstName: true, lastName: true } },
            },
          })
        : Promise.resolve([]),
    ])

    return ok({
      query: q,
      doctors: doctors.map((d: { id: string; firstName: string; lastName: string; specialization: string; city: string | null; avatarUrl: string | null; averageRating: unknown; consultationFee: unknown; premioTier: string }) => ({
        id:       d.id,
        name:     `د. ${d.firstName} ${d.lastName}`,
        specialty: d.specialization,
        city:     d.city,
        avatar:   d.avatarUrl,
        rating:   Number(d.averageRating),
        fee:      d.consultationFee ? Number(d.consultationFee) : null,
        premioTier: d.premioTier,
        type:     'doctor',
      })),
      facilities: facilities.map((f: any) => ({
        id:     f.id,
        name:   f.name,
        type:   f.type,
        city:   f.city,
        logo:   f.logoUrl,
        rating: Number(f.averageRating),
        kind:   'facility',
      })),
      publications: publications.map((p: any) => ({
        id:      p.id,
        title:   p.title,
        summary: p.summary,
        author:  p.doctor ? `د. ${p.doctor.firstName} ${p.doctor.lastName}` : null,
        type:    'publication',
      })),
    })
  } catch (err) {
    console.error('[GET /api/search]', err)
    return serverError()
  }
}
