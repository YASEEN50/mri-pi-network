import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const ad = await prisma.paidAdvertisement.findUnique({
    where: { id },
    select: { linkUrl: true, status: true },
  })

  if (!ad || ad.status !== 'ACTIVE') {
    return NextResponse.redirect(new URL('/', process.env.NEXTAUTH_URL ?? 'http://localhost:3000'))
  }

  await prisma.paidAdvertisement.update({
    where: { id },
    data: { clickCount: { increment: 1 } },
  }).catch(() => {})

  return NextResponse.redirect(ad.linkUrl)
}
