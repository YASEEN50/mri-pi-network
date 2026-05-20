// src/lib/upstash-rate-limit.ts
// Rate limiting عبر Upstash — مع fallback في الذاكرة عند غياب Redis

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { rateLimit as memoryRateLimit } from '@/lib/rate-limit'

export interface RateLimitCheckResult {
  success:   boolean
  remaining: number
  resetIn:   number
}

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

const limiters = new Map<string, Ratelimit>()

function getLimiter(name: string, requests: number, window: `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`): Ratelimit | null {
  const r = getRedis()
  if (!r) return null
  if (!limiters.has(name)) {
    limiters.set(
      name,
      new Ratelimit({
        redis:    r,
        limiter:  Ratelimit.slidingWindow(requests, window),
        prefix:   `medical:${name}`,
        analytics: true,
      }),
    )
  }
  return limiters.get(name)!
}

async function checkUpstash(
  name: string,
  identifier: string,
  requests: number,
  window: `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`,
): Promise<RateLimitCheckResult | null> {
  const limiter = getLimiter(name, requests, window)
  if (!limiter) return null

  const { success, remaining, reset } = await limiter.limit(identifier)
  const resetIn = Math.max(0, Math.ceil((reset - Date.now()) / 1000))
  return { success, remaining, resetIn }
}

function memoryFallback(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitCheckResult {
  const r = memoryRateLimit({ key, limit, windowMs })
  return { success: r.success, remaining: r.remaining, resetIn: r.resetIn }
}

/** GET /api/doctors — 100 طلب/دقيقة (حسب IP) */
export async function rateLimitDoctors(ip: string): Promise<RateLimitCheckResult> {
  const upstash = await checkUpstash('doctors', ip, 100, '1 m')
  if (upstash) return upstash
  return memoryFallback(`doctors:${ip}`, 100, 60_000)
}

/** POST /api/reviews — 20 طلب/دقيقة (حسب IP) */
export async function rateLimitReviews(ip: string): Promise<RateLimitCheckResult> {
  const upstash = await checkUpstash('reviews', ip, 20, '1 m')
  if (upstash) return upstash
  return memoryFallback(`reviews:${ip}`, 20, 60_000)
}

/** POST /api/doctor/upload-license — 5 طلب/دقيقة لكل طبيب */
export async function rateLimitUploadLicense(doctorUserId: string): Promise<RateLimitCheckResult> {
  const upstash = await checkUpstash('upload-license', doctorUserId, 5, '1 m')
  if (upstash) return upstash
  return memoryFallback(`upload-license:${doctorUserId}`, 5, 60_000)
}

export function rateLimitResponse(rl: RateLimitCheckResult) {
  return {
    error:   true,
    message: `تجاوزت حد الطلبات. انتظر ${rl.resetIn} ثانية.`,
    resetIn: rl.resetIn,
  }
}
