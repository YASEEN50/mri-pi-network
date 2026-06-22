/** node scripts/auth-pages-test.mjs */
import { PrismaClient } from '@prisma/client'
import { encode } from 'next-auth/jwt'

const BASE = 'http://localhost:3000'
const prisma = new PrismaClient()

async function cookie(email) {
  const u = await prisma.user.findUnique({ where: { email } })
  const token = await encode({
    token: { sub: u.id, id: u.id, email: u.email, role: u.role, isProfileComplete: true },
    secret: process.env.NEXTAUTH_SECRET,
  })
  return `next-auth.session-token=${token}`
}

async function page(path, c) {
  const r = await fetch(`${BASE}${path}`, { headers: c ? { Cookie: c } : {}, redirect: 'manual' })
  return { status: r.status, loc: r.headers.get('location') }
}

async function main() {
  const tests = []

  // Wrong login via credentials API
  const bad = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      email: 'admin@medical-platform.com',
      password: 'wrong-password',
      csrfToken: 'test',
      callbackUrl: '/',
      json: 'true',
    }),
    redirect: 'manual',
  })
  tests.push(['Auth wrong password', bad.status, await bad.text().then(t => t.slice(0,80))])

  // Dashboard pages per role
  const pages = {
    CLIENT: ['/dashboard/client/appointments', '/doctors', '/onboarding/client'],
    DOCTOR: ['/doctor/verify', '/dashboard/doctor/schedule', '/onboarding/doctor'],
    FACILITY: ['/dashboard/facility/overview', '/dashboard/facility/doctors', '/onboarding/facility'],
    ADMIN: ['/admin/verification', '/admin', '/dashboard/admin/pending'],
    OWNER: ['/owner', '/owner/risk-config'],
  }

  const accounts = {
    CLIENT: 'client@test.com',
    DOCTOR: 'doctor@test.com',
    FACILITY: 'facility@test.com',
    ADMIN: 'admin@medical-platform.com',
    OWNER: 'owner@medical-platform.com',
  }

  for (const [role, paths] of Object.entries(pages)) {
    const c = await cookie(accounts[role])
    for (const p of paths) {
      const r = await page(p, c)
      tests.push([`${role} ${p}`, r.status, r.loc ?? ''])
    }
  }

  // Notifications
  const clientC = await cookie('client@test.com')
  const notif = await fetch(`${BASE}/api/notifications`, { headers: { Cookie: clientC } })
  tests.push(['GET /api/notifications', notif.status, JSON.stringify(await notif.json()).slice(0,100)])

  // Reviews via doctor endpoint
  const doc = await prisma.doctorProfile.findFirst({ where: { approvalStatus: 'APPROVED' } })
  if (doc) {
    const rev = await fetch(`${BASE}/api/doctors/${doc.id}/reviews`)
    tests.push(['GET /api/doctors/[id]/reviews', rev.status, ''])
  }

  // Owner tasks - check if page exists
  const ownerC = await cookie('owner@medical-platform.com')
  const tasks = await page('/owner/tasks', ownerC)
  tests.push(['OWNER /owner/tasks', tasks.status, tasks.loc ?? ''])

  // Facility pending
  const facC = await cookie('facility@test.com')
  const fp = await page('/facility/pending', facC)
  tests.push(['FACILITY /facility/pending', fp.status, ''])

  // Middleware block client from admin
  const block = await page('/admin/verification', clientC)
  tests.push(['CLIENT blocked from /admin', block.status, block.loc ?? ''])

  for (const [name, status, detail] of tests) {
    const ok = status === 200 || status === 307 || status === 308
    console.log(`${ok ? '✅' : '❌'} ${name} — ${status} ${detail}`)
  }

  await prisma.$disconnect()
}

main()
