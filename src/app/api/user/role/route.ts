// src/app/api/user/role/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Role } from '@prisma/client'

const schema = z.object({
  role: z.enum([Role.CLIENT, Role.DOCTOR, Role.FACILITY]),
})

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  // فقط المستخدمون الجدد (بدون profile) يمكنهم تغيير الدور
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      clientProfile: true,
      doctorProfile: true,
      facilityProfile: true,
    },
  })

  const hasProfile = user?.clientProfile || user?.doctorProfile || user?.facilityProfile
  if (hasProfile) {
    return NextResponse.json({ error: 'ROLE_ALREADY_SET' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_ROLE' }, { status: 400 })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { role: parsed.data.role },
  })

  return NextResponse.json({ success: true })
}
