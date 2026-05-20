// src/lib/fraud-intelligence/redis.ts
// =============================================================================
// Redis client — يستخدم ioredis في الإنتاج، in-memory fallback في التطوير
// =============================================================================

// ─── In-Memory Fallback (dev بدون Redis) ─────────────────────────────────────

class InMemoryStore {
  private store = new Map<string, { value: string; expiry: number | null }>()

  private isExpired(key: string): boolean {
    const entry = this.store.get(key)
    if (!entry) return true
    if (entry.expiry && Date.now() > entry.expiry) {
      this.store.delete(key)
      return true
    }
    return false
  }

  async get(key: string): Promise<string | null> {
    if (this.isExpired(key)) return null
    return this.store.get(key)?.value ?? null
  }

  async set(key: string, value: string, exSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiry: exSeconds ? Date.now() + exSeconds * 1000 : null,
    })
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key)
    const next    = (parseInt(current ?? '0') || 0) + 1
    const entry   = this.store.get(key)
    this.store.set(key, { value: String(next), expiry: entry?.expiry ?? null })
    return next
  }

  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.store.get(key)
    if (entry) {
      this.store.set(key, { ...entry, expiry: Date.now() + seconds * 1000 })
    }
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$')
    return Array.from(this.store.keys()).filter(k => regex.test(k) && !this.isExpired(k))
  }

  // تنظيف المفاتيح المنتهية
  cleanup(): void {
    for (const key of this.store.keys()) this.isExpired(key)
  }
}

// ─── Redis Interface ──────────────────────────────────────────────────────────

export interface CacheClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, exSeconds?: number): Promise<void>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<void>
  del(key: string): Promise<void>
  keys(pattern: string): Promise<string[]>
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _client: CacheClient | null = null

export function getCacheClient(): CacheClient {
  if (_client) return _client

  const redisUrl = process.env.REDIS_URL

  if (redisUrl) {
    // ioredis — lazy import لعدم كسر التطوير بدون Redis
    const Redis = (() => {
      try {
        return require('ioredis')
      } catch {
        return null
      }
    })()

    if (Redis) {
      const redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect:          true,
        enableOfflineQueue:   false,
      })

      redis.on('error', (err: Error) => {
        if (!err.message.includes('ECONNREFUSED')) {
          console.error('[Redis] Error:', err.message)
        }
      })

      // Wrap ioredis to match CacheClient interface
      _client = {
        get:    (k)       => redis.get(k),
        set:    (k, v, s) => s ? redis.set(k, v, 'EX', s).then(() => {}) : redis.set(k, v).then(() => {}),
        incr:   (k)       => redis.incr(k),
        expire: (k, s)    => redis.expire(k, s).then(() => {}),
        del:    (k)       => redis.del(k).then(() => {}),
        keys:   (p)       => redis.keys(p),
      }

      console.log('[FraudIntelligence] Using Redis:', redisUrl.split('@').pop())
      return _client
    }
  }

  // Fallback
  console.log('[FraudIntelligence] Using in-memory cache (set REDIS_URL for production)')
  const mem = new InMemoryStore()

  // تنظيف كل 5 دقائق
  setInterval(() => mem.cleanup(), 5 * 60 * 1000)

  _client = mem
  return _client
}

// ─── Key Builders ─────────────────────────────────────────────────────────────

export const CacheKeys = {
  ipAttempts:     (ip: string)       => `fi:ip:${ip}:attempts`,
  ipFails:        (ip: string)       => `fi:ip:${ip}:fails`,
  deviceAttempts: (deviceId: string) => `fi:device:${deviceId}:attempts`,
  userUploads:    (userId: string)   => `fi:user:${userId}:uploads`,
  sessionTiming:  (sessionId: string) => `fi:session:${sessionId}:timing`,
} as const

export const TTL = {
  TEN_MIN:   10 * 60,
  ONE_HOUR:  60 * 60,
  ONE_DAY:   24 * 60 * 60,
} as const
