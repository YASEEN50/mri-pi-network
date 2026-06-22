/**
 * اختبار شامل — node scripts/comprehensive-test.mjs
 * يتطلب خادم dev على localhost:3000
 */
import { PrismaClient, Role } from '@prisma/client'
import { encode } from 'next-auth/jwt'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const prisma = new PrismaClient()
const report = { pass: [], fail: [], warn: [] }

function ok(cat, name, detail = '') {
  report.pass.push({ cat, name, detail })
  console.log(`✅ [${cat}] ${name}${detail ? ` — ${detail}` : ''}`)
}
function no(cat, name, detail = '') {
  report.fail.push({ cat, name, detail })
  console.error(`❌ [${cat}] ${name}${detail ? ` — ${detail}` : ''}`)
}
function warn(cat, name, detail = '') {
  report.warn.push({ cat, name, detail })
  console.warn(`⚠️ [${cat}] ${name}${detail ? ` — ${detail}` : ''}`)
}

async function cookieFor(email) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error(`User not found: ${email}`)
  const token = await encode({
    token: {
      sub: user.id, id: user.id, email: user.email, role: user.role,
      isProfileComplete: user.isProfileComplete ?? true,
    },
    secret: process.env.NEXTAUTH_SECRET,
  })
  return `next-auth.session-token=${token}`
}

async function fetchJson(path, opts = {}) {
  const t0 = Date.now()
  const res = await fetch(`${BASE}${path}`, opts)
  const ms = Date.now() - t0
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { json = { raw: text.slice(0, 300) } }
  return { status: res.status, json, ms, headers: res.headers }
}

async function waitServer(max = 30) {
  for (let i = 0; i < max; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`)
      if (r.ok) return true
    } catch {}
    await new Promise(r => setTimeout(r, 1000))
  }
  return false
}

async function main() {
  console.log('\n=== MRI Pi Network — Comprehensive Test ===\n')

  // 1. Build & runtime
  if (!(await waitServer())) {
    no('Build', 'Dev server on :3000', 'Server not responding')
    await writeReport()
    process.exit(1)
  }
  ok('Build', 'Dev server on localhost:3000')

  const health = await fetchJson('/api/health')
  if (health.status === 200) ok('Build', 'GET /api/health', `${health.ms}ms`)
  else no('Build', 'GET /api/health', `status=${health.status}`)

  // 2. Database
  try {
    await prisma.$queryRaw`SELECT 1`
    ok('Database', 'Prisma connectivity')
  } catch (e) {
    no('Database', 'Prisma connectivity', e.message)
  }

  const modelCount = (readFileSync('prisma/schema.prisma', 'utf8').match(/^model /gm) ?? []).length
  const tables = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY table_name`
  ok('Database', 'Schema models count', `${modelCount} models in schema`)
  ok('Database', 'DB tables count', `${tables.length} tables in public schema`)

  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@medical-platform.com' } })
  if (adminUser) ok('Database', 'Seed admin account exists', adminUser.email)
  else warn('Database', 'Seed admin account', 'admin@medical-platform.com not found — run seed')

  // 3. Auth pages
  for (const path of ['/login', '/register']) {
    const r = await fetch(`${BASE}${path}`)
    const html = await r.text()
    if (r.status === 200 && html.includes('<!DOCTYPE html')) ok('Auth', `Page ${path} renders`, `${r.status}`)
    else no('Auth', `Page ${path} renders`, `status=${r.status}`)
  }

  const loginHtml = await (await fetch(`${BASE}/login`)).text()
  if (/Pi Network|pi-login|PiLogin/i.test(loginHtml)) ok('Auth', 'Pi Network login button present in HTML')
  else warn('Auth', 'Pi Network login button', 'Not found in static HTML (may be client-rendered)')

  // Register API
  const regEmail = `test-reg-${Date.now()}@test.local`
  const reg = await fetchJson('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: regEmail, password: 'Test@123456', role: 'CLIENT' }),
  })
  if (reg.status === 200 || reg.status === 201) ok('Auth', 'POST /api/auth/register', regEmail)
  else no('Auth', 'POST /api/auth/register', `status=${reg.status} ${JSON.stringify(reg.json).slice(0,100)}`)

  // 4. Role-based API access
  const roles = [
    { email: 'client@test.com', cat: 'CLIENT' },
    { email: 'doctor@test.com', cat: 'DOCTOR' },
    { email: 'admin@medical-platform.com', cat: 'ADMIN' },
    { email: 'owner@medical-platform.com', cat: 'OWNER' },
  ]

  for (const { email, cat } of roles) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) { warn('Roles', `${cat} test account`, `${email} missing`); continue }
    ok('Roles', `${cat} account exists`, email)
  }

  // CLIENT flows
  try {
    const clientCookie = await cookieFor('client@test.com')
    const doctors = await fetchJson('/api/doctors?search=محمد&limit=5')
    if (doctors.status === 200) ok('CLIENT', 'GET /api/doctors?search=', `${doctors.ms}ms`)
    else no('CLIENT', 'GET /api/doctors', `status=${doctors.status}`)

    const doc = await prisma.doctorProfile.findFirst({ where: { approvalStatus: 'APPROVED' } })
    if (doc) {
      const profile = await fetchJson(`/api/doctors/${doc.id}`)
      if (profile.status === 200) ok('CLIENT', 'GET /api/doctors/[id]', doc.id)
      else no('CLIENT', 'GET /api/doctors/[id]', `status=${profile.status}`)

      const reviewsPage = await fetch(`${BASE}/doctors/${doc.id}/reviews`)
      if (reviewsPage.status === 200) ok('CLIENT', 'Page /doctors/[id]/reviews', `${doc.id}`)
      else no('CLIENT', 'Page /doctors/[id]/reviews', `status=${reviewsPage.status}`)
    }

    const reviews = await fetchJson('/api/reviews?limit=5', { headers: { Cookie: clientCookie } })
    if (reviews.status === 200) ok('CLIENT', 'GET /api/reviews', `${reviews.ms}ms`)
    else warn('CLIENT', 'GET /api/reviews', `status=${reviews.status}`)
  } catch (e) {
    no('CLIENT', 'Client flows', e.message)
  }

  // DOCTOR flows
  try {
    const doctorCookie = await cookieFor('doctor@test.com')
    const vStatus = await fetchJson('/api/doctor/verification-status', { headers: { Cookie: doctorCookie } })
    if (vStatus.status === 200) ok('DOCTOR', 'GET /api/doctor/verification-status', JSON.stringify(vStatus.json?.data?.currentState ?? vStatus.json?.currentState ?? '').slice(0,50))
    else no('DOCTOR', 'GET /api/doctor/verification-status', `status=${vStatus.status}`)
  } catch (e) {
    no('DOCTOR', 'Doctor flows', e.message)
  }

  // ADMIN flows
  try {
    const adminCookie = await cookieFor('admin@medical-platform.com')
    const verification = await fetchJson('/api/admin/verification?status=WAITING', { headers: { Cookie: adminCookie } })
    if (verification.status === 200) {
      const count = verification.json?.data?.length ?? verification.json?.meta?.total ?? 0
      ok('ADMIN', 'GET /api/admin/verification (PENDING_HUMAN)', `items=${count}`)
    } else no('ADMIN', 'GET /api/admin/verification', `status=${verification.status}`)

    const stats = await fetchJson('/api/admin/stats', { headers: { Cookie: adminCookie } })
    if (stats.status === 200) ok('ADMIN', 'GET /api/admin/stats', `${stats.ms}ms`)
    else no('ADMIN', 'GET /api/admin/stats', `status=${stats.status}`)

    for (const path of ['/admin/verification', '/admin/fraud-events', '/admin']) {
      const r = await fetch(`${BASE}${path}`, { headers: { Cookie: adminCookie }, redirect: 'manual' })
      if (r.status === 200 || r.status === 307 || r.status === 308) ok('ADMIN', `Page ${path}`, `status=${r.status}`)
      else warn('ADMIN', `Page ${path}`, `status=${r.status}`)
    }
  } catch (e) {
    no('ADMIN', 'Admin flows', e.message)
  }

  // OWNER flows
  try {
    const ownerCookie = await cookieFor('owner@medical-platform.com')
    for (const path of ['/owner', '/owner/risk-config']) {
      const r = await fetch(`${BASE}${path}`, { headers: { Cookie: ownerCookie }, redirect: 'manual' })
      if (r.status === 200) ok('OWNER', `Page ${path}`)
      else warn('OWNER', `Page ${path}`, `status=${r.status}`)
    }
  } catch (e) {
    warn('OWNER', 'Owner flows', e.message)
  }

  // 5. Verification pipeline check in DB
  const pendingHuman = await prisma.verificationSession.count({ where: { currentState: 'PENDING_HUMAN', isActive: true } })
  const pendingAi = await prisma.verificationSession.count({ where: { currentState: 'PENDING_AI', isActive: true } })
  ok('Verification', 'Session states in DB', `PENDING_HUMAN=${pendingHuman}, PENDING_AI=${pendingAi}`)

  const legacyQueue = await prisma.verificationQueue.count()
  ok('Verification', 'Legacy verification_queue sync table', `${legacyQueue} rows`)

  // 6. Doctors map page
  const mapPage = await fetch(`${BASE}/doctors-map`)
  if (mapPage.status === 404) warn('Map', '/doctors-map page', 'Route not found (404)')
  else if (mapPage.status === 200) ok('Map', '/doctors-map page loads')
  else warn('Map', '/doctors-map page', `status=${mapPage.status}`)

  // 7. Security
  const workerNoSecret = await fetchJson('/api/workers/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  if (workerNoSecret.status === 401 || workerNoSecret.status === 403) ok('Security', 'Workers reject without WORKER_SECRET', `status=${workerNoSecret.status}`)
  else no('Security', 'Workers reject without WORKER_SECRET', `status=${workerNoSecret.status}`)

  const adminNoAuth = await fetchJson('/api/admin/stats')
  if (adminNoAuth.status === 401 || adminNoAuth.status === 403) ok('Security', 'Admin API requires auth', `status=${adminNoAuth.status}`)
  else no('Security', 'Admin API requires auth', `status=${adminNoAuth.status}`)

  if (existsSync('.env') && !existsSync('.git/HEAD')) {
    warn('Security', '.git check', 'Not a git repo')
  } else {
    const gitignore = readFileSync('.gitignore', 'utf8')
    if (gitignore.includes('.env')) ok('Security', '.env in .gitignore')
    else no('Security', '.env in .gitignore', 'missing')
  }

  const hasUpstash = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  if (hasUpstash) ok('Security', 'Upstash rate limit configured')
  else warn('Security', 'Upstash rate limiting', 'UPSTASH_* not set — rate limit may be disabled in dev')

  // 8. Documentation
  for (const f of ['README.md', 'docs/API.md', 'docs/DEPLOYMENT.md']) {
    if (existsSync(f)) {
      const content = readFileSync(f, 'utf8')
      if (content.length > 200) ok('Docs', f, `${content.length} chars`)
      else warn('Docs', f, 'File exists but seems thin')
    } else no('Docs', f, 'missing')
  }

  // 9. Performance — page load times
  const perfPaths = ['/', '/login', '/doctors', '/api/health']
  for (const p of perfPaths) {
    const r = await fetchJson(p)
    if (r.ms < 3000) ok('Performance', `${p} load time`, `${r.ms}ms`)
    else warn('Performance', `${p} load time`, `${r.ms}ms (>3s)`)
  }

  // 10. Pi payments
  if (process.env.PI_API_KEY) ok('Pi Payments', 'PI_API_KEY configured')
  else warn('Pi Payments', 'PI_API_KEY', 'not set — payment button may be hidden')

  // 11. Image compression lib
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    if (pkg.dependencies?.['browser-image-compression']) ok('Performance', 'browser-image-compression in package.json')
    else no('Performance', 'browser-image-compression', 'missing from package.json')
  } catch {}

  await writeReport()
  await prisma.$disconnect()
  process.exit(report.fail.length > 0 ? 1 : 0)
}

async function writeReport() {
  const out = join(process.cwd(), 'scripts', 'test-report.json')
  const { writeFile } = await import('fs/promises')
  await writeFile(out, JSON.stringify(report, null, 2))
  console.log(`\n--- Summary: ${report.pass.length} pass, ${report.fail.length} fail, ${report.warn.length} warn ---`)
  console.log(`Report: ${out}`)
}

main().catch(e => { console.error(e); process.exit(1) })
