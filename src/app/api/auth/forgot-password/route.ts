// src/app/api/auth/forgot-password/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'
import { rateLimitAuth } from '@/lib/rate-limit'
import { Resend } from 'resend'
import { z } from 'zod'

const resend    = new Resend(process.env.RESEND_API_KEY)
const FROM      = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
const APP_NAME  = 'المنصة الطبية'
const BASE_URL  = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const Schema    = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    const rl  = rateLimitAuth(ip, 'forgot-password')
    if (!rl.success) {
      return ok({ error: true, message: `محاولات كثيرة. انتظر ${rl.resetIn} ثانية.` })
    }

    const body   = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بريد إلكتروني غير صحيح' })

    const { email } = parsed.data

    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    })

    // نرجع نفس الرسالة سواء وُجد البريد أم لا (أمان)
    if (!user) {
      return ok({ sent: true, message: 'إذا كان البريد مسجلاً، ستصلك رسالة خلال دقائق' })
    }

    // حذف الرموز القديمة
    await prisma.verificationToken.deleteMany({
      where: { identifier: `reset:${email}` },
    })

    // رمز OTP 6 أرقام
    const otp     = Math.floor(100000 + Math.random() * 900000).toString()
    const expires = new Date(Date.now() + 15 * 60 * 1000) // 15 دقيقة

    await prisma.verificationToken.create({
      data: { identifier: `reset:${email}`, token: otp, expires },
    })

    // إرسال البريد
    await resend.emails.send({
      from:    FROM,
      to:      email,
      subject: `رمز إعادة تعيين كلمة المرور - ${APP_NAME}`,
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0f172a;color:white;border-radius:16px;">
          <div style="text-align:center;margin-bottom:24px;">
            <h2 style="color:#10b981;font-size:20px;margin:0;">🔐 إعادة تعيين كلمة المرور</h2>
            <p style="color:#94a3b8;font-size:14px;margin-top:8px;">${APP_NAME}</p>
          </div>

          <p style="color:#cbd5e1;font-size:14px;margin-bottom:8px;">مرحباً،</p>
          <p style="color:#94a3b8;font-size:14px;margin-bottom:24px;">
            تلقينا طلباً لإعادة تعيين كلمة المرور. استخدم الرمز التالي:
          </p>

          <div style="background:#1e293b;border:2px solid #10b981;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
            <p style="color:#94a3b8;font-size:12px;margin:0 0 8px;">رمز التحقق</p>
            <p style="color:#10b981;font-size:36px;font-weight:bold;letter-spacing:12px;margin:0;">${otp}</p>
            <p style="color:#64748b;font-size:12px;margin:8px 0 0;">صالح لمدة <strong style="color:#f59e0b;">15 دقيقة</strong> فقط</p>
          </div>

          <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:12px;margin-bottom:20px;">
            <p style="color:#64748b;font-size:12px;margin:0;">
              ⚠️ إذا لم تطلب هذا الرمز، تجاهل هذا البريد وكلمة مرورك آمنة.
            </p>
          </div>

          <p style="color:#475569;font-size:11px;text-align:center;">
            ${APP_NAME} · لا تشارك هذا الرمز مع أحد
          </p>
        </div>
      `,
    })

    return ok({ sent: true, message: 'تم إرسال رمز التحقق لبريدك الإلكتروني' })
  } catch (err) {
    console.error('[POST /api/auth/forgot-password]', err)
    return serverError()
  }
}
