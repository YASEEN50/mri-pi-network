// src/lib/rate-limit.ts
// Rate limiter بسيط باستخدام in-memory store (مناسب للإنتاج مع Redis لاحقاً)

interface RateLimitEntry {
  count:     number
  resetTime: number
}

const store = new Map<string, RateLimitEntry>()

// تنظيف دوري كل 5 دقائق
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetTime) store.delete(key)
  }
}, 5 * 60 * 1000)

export interface RateLimitResult {
  success:   boolean
  remaining: number
  resetIn:   number  // ثواني
}

export function rateLimit(params: {
  key:      string   // عادةً IP + endpoint
  limit:    number   // عدد الطلبات المسموحة
  windowMs: number   // النافذة الزمنية بالميلي ثانية
}): RateLimitResult {
  const { key, limit, windowMs } = params
  const now    = Date.now()
  const entry  = store.get(key)

  if (!entry || now > entry.resetTime) {
    store.set(key, { count: 1, resetTime: now + windowMs })
    return { success: true, remaining: limit - 1, resetIn: Math.ceil(windowMs / 1000) }
  }

  if (entry.count >= limit) {
    return {
      success:   false,
      remaining: 0,
      resetIn:   Math.ceil((entry.resetTime - now) / 1000),
    }
  }

  entry.count++
  return {
    success:   true,
    remaining: limit - entry.count,
    resetIn:   Math.ceil((entry.resetTime - now) / 1000),
  }
}

// دوال جاهزة للـ endpoints الشائعة
export function rateLimitAuth(ip: string, endpoint: string): RateLimitResult {
  return rateLimit({
    key:      `auth:${ip}:${endpoint}`,
    limit:    5,          // 5 محاولات
    windowMs: 15 * 60 * 1000, // كل 15 دقيقة
  })
}

export function rateLimitApi(ip: string, endpoint: string): RateLimitResult {
  return rateLimit({
    key:      `api:${ip}:${endpoint}`,
    limit:    30,         // 30 طلب
    windowMs: 60 * 1000,  // كل دقيقة
  })
}

export function rateLimitUpload(ip: string): RateLimitResult {
  return rateLimit({
    key:      `upload:${ip}`,
    limit:    10,
    windowMs: 60 * 60 * 1000, // كل ساعة
  })
}
