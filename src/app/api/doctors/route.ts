// src/app/api/doctors/route.ts
// GET /api/doctors — بحث وفلترة (أطباء مع Premio نشط فقط)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'
import { rateLimitDoctors, rateLimitResponse } from '@/lib/upstash-rate-limit'
import { doctorProfilePublicWhere, expireStalePremios } from '@/lib/premio/active-premio'

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

    const where = doctorProfilePublicWhere({
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName:  { contains: search, mode: 'insensitive' } },
          { specialization: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(specialization && { specialization: { contains: specialization, mode: 'insensitive' } }),
      ...(city && { city: { contains: city, mode: 'insensitive' } }),
    })

    const [doctors, total] = await Promise.all([
      prisma.doctorProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ averageRating: 'desc' }, { totalReviews: 'desc' }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          specialization: true,
          subSpecialization: true,
          yearsOfExperience: true,
          city: true,
          country: true,
          consultationFee: true,
          averageRating: true,
          totalReviews: true,
          avatarUrl: true,
          bio: true,
        },
      }),
      prisma.doctorProfile.count({ where }),
    ])

    return ok(
      doctors.map((d: any) => ({
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
      })),
      { total, page, limit }
    )
  } catch (err) {
    console.error('[GET /api/doctors]', err)
    return serverError()
  }
}
