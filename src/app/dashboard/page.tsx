// src/app/dashboard/page.tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Role } from '@prisma/client'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  switch (session.user.role) {
    case Role.OWNER:    redirect('/owner')
    case Role.ADMIN:    redirect('/dashboard/admin/verification')
    case Role.DOCTOR:   redirect('/dashboard/doctor/schedule')
    case Role.FACILITY: redirect('/dashboard/facility/overview')
    default:            redirect('/dashboard/client/appointments')
  }
}
