#!/usr/bin/env node
/**
 * Retry prisma migrate deploy on Vercel (Neon cold start + advisory lock).
 */
import { execSync } from 'node:child_process'

const ATTEMPTS = 3
const DELAY_MS = 15_000

async function main() {
  for (let i = 1; i <= ATTEMPTS; i++) {
    try {
      console.log(`[vercel-migrate] attempt ${i}/${ATTEMPTS}`)
      execSync('npx prisma migrate deploy', { stdio: 'inherit' })
      console.log('[vercel-migrate] success')
      return
    } catch {
      if (i === ATTEMPTS) {
        console.error('[vercel-migrate] failed after all attempts')
        process.exit(1)
      }
      console.warn(`[vercel-migrate] retrying in ${DELAY_MS / 1000}s...`)
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }
}

main()
