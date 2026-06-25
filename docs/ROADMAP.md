# خارطة تطوير MRI — Medical Platform

> **آخر تحديث:** 2026-05-20  
> **الفرع:** `main`  
> **الحالة:** منجز — المرحلة 6.1

---

## المرحلة 1 — إغلاق الثغرات الحرجة (أسبوع 1–2)

| # | المهمة | الحالة | ملفات/ملاحظات |
|---|--------|--------|----------------|
| 1.1 | **Premio gating** — إظهار الأطباء في البحث/الخريطة/الصفحة الرئيسية فقط مع اشتراك Premio نشط | ✅ منجز | `src/lib/premio/active-premio.ts`, APIs, صفحات، seed |
| 1.2 | **السجلات الطبية** — رفع آمن، صلاحيات، audit log، موافقة مشاركة | ✅ منجز | `src/lib/medical-records/*`, upload + `/file` route |
| 1.3 | **صلاحيات Admin** — تفعيل التحقق على routes الحساسة | ✅ منجز | `src/lib/admin/permissions.ts`, `/api/admin/*` |
| 1.4 | **تنظيف الدفع** — إزالة/ربط `PaymentForm` المعطّل، Pi فقط | ✅ منجز | `PaymentForm.tsx`, `payForAppointment`, حذف `/api/payment/process` |
| 1.5 | **Pi production** — `PI_API_KEY`, incomplete payments, إزالة `pi-debug` | ✅ منجز | `pi-api-key.ts`, incomplete auth, health, حذف `/api/pi-debug` |

---

## المرحلة 2 — تجربة المستخدم (أسبوع 3–5)

| # | المهمة | الحالة |
|---|--------|--------|
| 2.1 | محادثة realtime (polling أو WebSocket) | ✅ منجز | `useChat`, `?since=`, `ChatWorkspace` |
| 2.2 | حجز مواعيد + availability + تأكيد + إشعار | ✅ منجز | slots API, booking validation, notifications |
| 2.3 | توحيد Pi shell مع Next.js (أو توثيق المسارات) | ✅ منجز | `pi-routes.ts`, `docs/PI_ROUTES.md`, redirects |
| 2.4 | ربط التقييمات بعد كل موعد مكتمل | ✅ منجز | REVIEW_REQUESTED notify, rating API, banner |
| 2.5 | i18n متسق (ar/en) للوحات التحكم | ✅ منجز | `useAppLocale`, `DashboardShell`, `dashboard.*` messages |

---

## المرحلة 3 — Monetization & Growth

| # | المهمة | الحالة |
|---|--------|--------|
| 3.1 | Referrals (UI + مكافآت Pi) | ✅ منجز | `/api/referrals`, doctor UI, REFERRAL_REWARD |
| 3.2 | Premio tiers (ظهور، badge، analytics) | ✅ منجز | `tiers.ts`, sort priority, PremioBadge, analytics gating |
| 3.3 | ONLINE: WebRTC/Jitsi أو إزالة النوع مؤقتاً | ✅ منجز | Jitsi embed, `/appointments/[id]/video`, env toggle |
| 3.4 | إشعارات push داخل Pi Browser | ✅ منجز | Web Notifications + polling, `PiPushProvider`, `?since=` |

---

## المرحلة 4 — امتثال وتوسع

| # | المهمة | الحالة |
|---|--------|--------|
| 4.1 | حذف حساب + تصدير بيانات (GDPR-ready) | ✅ منجز | `/api/account/export`, `/api/account/delete`, `PrivacyDataCard` |
| 4.2 | MFA للـ admin/owner | ✅ منجز | TOTP, backup codes, login challenge, `/admin/security/mfa` |
| 4.3 | سياسة retention للبيانات الصحية | ✅ منجز | cron `/api/cron/health-retention`, `docs/HEALTH_DATA_RETENTION.md` |
| 4.4 | CI + tests (auth، دفع، مواعيد) | ✅ منجز | GitHub Actions, Vitest, `docs/CI.md` |
| 4.5 | Sentry + monitoring | ✅ منجز | instrumentation, global-error, `/api/health`, `docs/SENTRY.md` |

---

## المرحلة 5 — لوحة المنشأة (مستشفى / مركز طبي)

| # | المهمة | الحالة | ملاحظات |
|---|--------|--------|---------|
| 5.1 | **أقسام المنشأة** — قالب 15 قسم + تفعيل/تعطيل | ✅ منجز | `FacilityDepartment`, `/dashboard/facility/departments` |
| 5.2 | **جدول المناوبات** — تعيين طبيب/قسم/فترة | ✅ منجز | `OnCallShift`, `/dashboard/facility/on-call`, عرض عام في `/facilities/[id]` |
| 5.3 | ربط الأطباء بالأقسام (UI) | ✅ منجز | `/dashboard/facility/department-doctors`, API assignments |
| 5.4 | إدارة مواعيد المنشأة | ✅ منجز | `/dashboard/facility/appointments`, تأكيد/إلغاء/إكمال |
| 5.5 | إعدادات ملف المنشأة | ✅ منجز | `/dashboard/facility/settings`, logo/cover upload |

**Migration:** `20260520160000_facility_departments_on_call` — `npx prisma migrate deploy` على production

---

## المرحلة 6 — استشارة فورية (Consult Now)

| # | المهمة | الحالة | ملاحظات |
|---|--------|--------|---------|
| 6.1 | **Consult Now MVP** — طبيب متاح + دفع π + قبول 90ث + محادثة | ✅ منجز | `/consult-now`, `/dashboard/doctor/instant-consult` |
| 6.2 | Broadcast — إشعار كل الأطباء المتاحين في التخصص | ⏳ قادم | أول قبول يفوز |
| 6.3 | فيديو فوري داخل الجلسة | ⏳ قادم | Jitsi room per instant consult |

**Migration:** `20260520180000_instant_consult`

---

## ما تم إنجازه سابقاً (مرجع)

- [x] Pi Authentication + account linking
- [x] Pi Payments (Premio U2A)
- [x] Login portal Phase 1–3 (pi-login.css + React auth)
- [x] خلفية طبية باهتة لصفحات الدخول
- [x] إصلاح Pi logout / menu flicker

---

## قواعد التنفيذ

1. **Premio gating** لا يؤثر على: admin، owner، الطبيب يرى ملفه، المواعيد القائمة.
2. **Pi Browser** و **Next.js** يشاركان نفس الـ API — التغييرات في API أولاً.
3. كل مهمة = commit منفصل مع تحديث هذا الملف.

---

## سجل التنفيذ

| التاريخ | المهمة | Commit |
|---------|--------|--------|
| 2026-05-20 | بدء المرحلة 1 — Premio gating | (قيد الرفع) |
