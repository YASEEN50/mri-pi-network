#!/usr/bin/env node
/**
 * Retry prisma migrate deploy on Vercel (Neon cold start + advisory lock / P1002).
 */
import { execSync } from 'node:child_process'

const MAX_ATTEMPTS = 6
const BASE_DELAY_MS = 20_000

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function withConnectTimeout(url, seconds = 30) {
  if (!url) return url
  try {
    const u = new URL(url)
    if (!u.searchParams.has('connect_timeout')) {
      u.searchParams.set('connect_timeout', String(seconds))
    }
    if (!u.searchParams.has('sslmode')) {
      u.searchParams.set('sslmode', 'require')
    }
    return u.toString()
  } catch {
    return url
  }
}

function validateEnv() {
  if (process.env.SKIP_MIGRATE_DEPLOY === '1' || process.env.SKIP_MIGRATE_DEPLOY === 'true') {
    console.warn('[vercel-migrate] SKIP_MIGRATE_DEPLOY set — skipping migrations')
    return false
  }

  const direct = process.env.DIRECT_URL
  if (!direct) {
    console.error(
      '[vercel-migrate] DIRECT_URL is missing in Vercel env vars.\n' +
        'Add Neon direct URL (no -pooler) — see docs/DEPLOYMENT.md',
    )
    process.exit(1)
  }

  if (direct.includes('-pooler')) {
    console.error(
      '[vercel-migrate] DIRECT_URL must use the direct Neon host (without -pooler).\n' +
        'Use DATABASE_URL for pooler and DIRECT_URL for direct connection.',
    )
    process.exit(1)
  }

  return true
}

function migrateEnv() {
  const direct = withConnectTimeout(process.env.DIRECT_URL, 45)
  const pooled = withConnectTimeout(process.env.DATABASE_URL, 45)
  return {
    ...process.env,
    DIRECT_URL: direct,
    DATABASE_URL: pooled ?? direct,
  }
}

function wakeDatabase(env) {
  console.log('[vercel-migrate] waking database...')
  execSync('npx prisma db execute --stdin', {
    input: 'SELECT 1;',
    stdio: ['pipe', 'inherit', 'inherit'],
    env: { ...env, DATABASE_URL: env.DIRECT_URL },
  })
}

function runMigrate(env) {
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env })
}

async function main() {
  if (!validateEnv()) return

  const env = migrateEnv()

  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    try {
      console.log(`[vercel-migrate] attempt ${i}/${MAX_ATTEMPTS}`)
      if (i === 1) {
        try {
          wakeDatabase(env)
        } catch (err) {
          console.warn('[vercel-migrate] wake query failed (Neon may be cold):', err?.message ?? err)
        }
      }
      runMigrate(env)
      console.log('[vercel-migrate] success')
      return
    } catch (err) {
      const delay = BASE_DELAY_MS * i
      if (i === MAX_ATTEMPTS) {
        console.error(
          '[vercel-migrate] failed after all attempts (P1002 = Neon timeout / advisory lock).\n' +
            'Check DIRECT_URL in Vercel, or set SKIP_MIGRATE_DEPLOY=1 temporarily if schema did not change.',
        )
        process.exit(1)
      }
      console.warn(`[vercel-migrate] attempt ${i} failed — retrying in ${delay / 1000}s...`)
      await sleep(delay)
    }
  }
}

main()
