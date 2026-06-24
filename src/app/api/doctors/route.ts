// src/app/api/doctors/route.ts
// GET /api/doctors — بحث وفلترة (أطباء مع Premio نشط فقط، مرتّبون حسب tier)
import { NextRequest, NextResponse } from 'next/server'
import { ok, serverError } from '@/lib/api-response'
import { rateLimitDoctors, rateLimitResponse } from '@/lib/upstash-rate-limit'
import { listPublicDoctors } from '@/lib/premio/list-doctors'
import { doctorProfilePublicWhere, expireStalePremios } from '@/lib/premio/active-premio'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await rateLimitDoctors(ip)
    if (!rl.success) {
      return NextResponse.json(rateLimitResponse(rl), {
        status: 429,
        headers: { 'Retry-After': String(rl.resetIn) },
      })
    }

    const { searchParams } = req.nextUrl
    const page           = Number(searchParams.get('page')  ?? 1)
    const limit          = Number(searchParams.get('limit') ?? 20)
    const skip           = (page - 1) * limit
    const search         = searchParams.get('search') ?? ''
    const specialization = searchParams.get('specialization') ?? ''
    const city           = searchParams.get('city') ?? ''

    await expireStalePremios()

    const where = {
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName:  { contains: search, mode: 'insensitive' as const } },
          { specialization: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(specialization && { specialization: { contains: specialization, mode: 'insensitive' as const } }),
      ...(city && { city: { contains: city, mode: 'insensitive' as const } }),
    }

    const [doctors, total] = await Promise.all([
      listPublicDoctors({ where, skip, take: limit }),
      prisma.doctorProfile.count({ where: doctorProfilePublicWhere(where) }),
    ])

    return ok(
      doctors.map(d => ({
        id: d.id,
        fullName: `${d.firstName} ${d.lastName}`,
        specialization: d.specialization,
        subSpecialization: d.subSpecialization,
        yearsOfExperience: d.yearsOfExperience,
        city: d.city,
        country: d.country,
        consultationFee: d.consultationFee ? Number(d.consultationFee) : null,
        averageRating: Number(d.averageRating),
        totalReviews: d.totalReviews,
        avatarUrl: d.avatarUrl,
        bio: d.bio,
        premioTier: d.premioTier,
      })),
      { total, page, limit },
    )
  } catch (err) {
    console.error('[GET /api/doctors]', err)
    return serverError()
  }
}
