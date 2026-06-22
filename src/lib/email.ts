// src/lib/email.ts
// خدمة إرسال الإيميلات عبر Resend

import { getResendClient } from '@/lib/resend-client'

const FROM_EMAIL = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
const PLATFORM_NAME = 'المنصة الطبية'
const BASE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

// =============================================================================
// 1. تأكيد البريد الإلكتروني عند التسجيل
// =============================================================================
export async function sendVerificationEmail(email: string, token: string) {
  const link = `${BASE_URL}/api/auth/verify-email?token=${token}`

  await getResendClient().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `تأكيد بريدك الإلكتروني - ${PLATFORM_NAME}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #0f172a; color: white; border-radius: 12px;">
        <h2 style="color: #10b981; margin-bottom: 16px;">مرحباً بك في ${PLATFORM_NAME} 👋</h2>
        <p style="color: #94a3b8; margin-bottom: 24px;">اضغط على الزر أدناه لتأكيد بريدك الإلكتروني:</p>
        <a href="${link}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          ✅ تأكيد البريد الإلكتروني
        </a>
        <p style="color: #475569; font-size: 12px; margin-top: 24px;">هذا الرابط صالح لمدة 24 ساعة فقط.</p>
        <p style="color: #475569; font-size: 12px;">إذا لم تقم بإنشاء حساب، تجاهل هذا البريد.</p>
      </div>
    `,
  })
}

// =============================================================================
// 2. تغيير البريد الإلكتروني
// =============================================================================
export async function sendChangeEmailVerification(newEmail: string, token: string) {
  const link = `${BASE_URL}/api/auth/confirm-email-change?token=${token}`

  await getResendClient().emails.send({
    from: FROM_EMAIL,
    to: newEmail,
    subject: `تأكيد تغيير البريد الإلكتروني - ${PLATFORM_NAME}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #0f172a; color: white; border-radius: 12px;">
        <h2 style="color: #10b981; margin-bottom: 16px;">تغيير البريد الإلكتروني 📧</h2>
        <p style="color: #94a3b8; margin-bottom: 8px;">طلبت تغيير بريدك الإلكتروني إلى:</p>
        <p style="color: white; font-weight: bold; margin-bottom: 24px;">${newEmail}</p>
        <p style="color: #94a3b8; margin-bottom: 16px;">اضغط على الزر لتأكيد التغيير:</p>
        <a href="${link}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          ✅ تأكيد تغيير البريد
        </a>
        <p style="color: #475569; font-size: 12px; margin-top: 24px;">هذا الرابط صالح لمدة ساعة واحدة فقط.</p>
        <p style="color: #475569; font-size: 12px;">إذا لم تطلب هذا التغيير، تجاهل هذا البريد.</p>
      </div>
    `,
  })
}

// =============================================================================
// 3. إعادة تعيين كلمة المرور
// =============================================================================
export async function sendPasswordResetEmail(email: string, token: string) {
  const link = `${BASE_URL}/reset-password?token=${token}`

  await getResendClient().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `إعادة تعيين كلمة المرور - ${PLATFORM_NAME}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #0f172a; color: white; border-radius: 12px;">
        <h2 style="color: #f59e0b; margin-bottom: 16px;">إعادة تعيين كلمة المرور 🔐</h2>
        <p style="color: #94a3b8; margin-bottom: 24px;">طلبت إعادة تعيين كلمة المرور. اضغط على الزر أدناه:</p>
        <a href="${link}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          🔑 إعادة تعيين كلمة المرور
        </a>
        <p style="color: #475569; font-size: 12px; margin-top: 24px;">هذا الرابط صالح لمدة ساعة واحدة فقط.</p>
        <p style="color: #475569; font-size: 12px;">إذا لم تطلب هذا، تجاهل هذا البريد وكلمة مرورك آمنة.</p>
      </div>
    `,
  })
}

// =============================================================================
// 4. إشعار تغيير كلمة المرور
// =============================================================================
// =============================================================================
// 5. اكتمال التحقق الآلي للطبيب
// =============================================================================
export async function sendDoctorAiVerificationCompleteEmail(email: string, doctorName: string) {
  await getResendClient().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `اكتمل التحقق الآلي — ${PLATFORM_NAME}`,
    html: emailCard(
      'اكتمل التحقق الآلي ✅',
      `<p style="color:#94a3b8">مرحباً د. <strong style="color:white">${doctorName}</strong>،</p>
       <p style="color:#94a3b8">تمت معالجة رخصتك وبياناتك آلياً بنجاح. طلبك الآن في قائمة <strong style="color:#fbbf24">المراجعة البشرية</strong> وسنُعلمك فور الموافقة.</p>`,
      `${BASE_URL}/doctor/pending`,
      'متابعة حالة الطلب',
      '#10b981',
    ),
  })
}

// =============================================================================
// 6. موافقة الأدمن على الطبيب
// =============================================================================
export async function sendDoctorApprovedEmail(email: string, doctorName: string) {
  await getResendClient().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `تم التحقق من حسابك — ${PLATFORM_NAME}`,
    html: emailCard(
      'تهانينا! تم اعتماد حسابك 🎉',
      `<p style="color:#94a3b8">مرحباً د. <strong style="color:white">${doctorName}</strong>،</p>
       <p style="color:#94a3b8">تمت الموافقة على طلب التحقق. يمكنك الآن استقبال المرضى وإدارة مواعيدك.</p>`,
      `${BASE_URL}/dashboard/doctor`,
      'الذهاب للوحة التحكم',
      '#10b981',
    ),
  })
}

// =============================================================================
// 7. إشعار المنشأة باعتماد طبيب مرتبط
// =============================================================================
export async function sendFacilityDoctorApprovedEmail(
  email: string,
  facilityName: string,
  doctorName: string,
) {
  await getResendClient().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `طبيب معتمد في ${facilityName}`,
    html: emailCard(
      'طبيب معتمد في منشأتك 👨‍⚕️',
      `<p style="color:#94a3b8">تم اعتماد الدكتور <strong style="color:white">${doctorName}</strong> في منشأة <strong style="color:white">${facilityName}</strong>.</p>`,
      `${BASE_URL}/dashboard/facility/doctors`,
      'عرض الأطباء',
      '#14b8a6',
    ),
  })
}

function emailCard(
  title: string,
  bodyHtml: string,
  link: string,
  linkLabel: string,
  accent: string,
) {
  return `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#0f172a;color:white;border-radius:12px;">
      <h2 style="color:${accent};margin-bottom:16px;">${title}</h2>
      ${bodyHtml}
      <a href="${link}" style="display:inline-block;margin-top:20px;background:${accent};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">${linkLabel}</a>
    </div>
  `
}

export async function sendPasswordChangedNotification(email: string) {
  await getResendClient().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `تم تغيير كلمة المرور - ${PLATFORM_NAME}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #0f172a; color: white; border-radius: 12px;">
        <h2 style="color: #10b981; margin-bottom: 16px;">تم تغيير كلمة المرور ✅</h2>
        <p style="color: #94a3b8;">تم تغيير كلمة مرور حسابك بنجاح.</p>
        <p style="color: #94a3b8; margin-top: 8px;">إذا لم تقم بهذا التغيير، تواصل معنا فوراً.</p>
      </div>
    `,
  })
}