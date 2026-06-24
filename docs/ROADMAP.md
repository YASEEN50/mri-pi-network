# خارطة تطوير MRI — Medical Platform

> **آخر تحديث:** 2026-05-20  
> **الفرع:** `main`  
> **الحالة:** قيد التنفيذ — المرحلة 2

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
| 2.2 | حجز مواعيد + availability + تأكيد + إشعار | ⬜ |
| 2.3 | توحيد Pi shell مع Next.js (أو توثيق المسارات) | ⬜ |
| 2.4 | ربط التقييمات بعد كل موعد مكتمل | ⬜ |
| 2.5 | i18n متسق (ar/en) للوحات التحكم | ⬜ |

---

## المرحلة 3 — Monetization & Growth

| # | المهمة | الحالة |
|---|--------|--------|
| 3.1 | Referrals (UI + مكافآت Pi) | ⬜ |
| 3.2 | Premio tiers (ظهور، badge، analytics) | ⬜ |
| 3.3 | ONLINE: WebRTC/Jitsi أو إزالة النوع مؤقتاً | ⬜ |
| 3.4 | إشعارات push داخل Pi Browser | ⬜ |

---

## المرحلة 4 — امتثال وتوسع

| # | المهمة | الحالة |
|---|--------|--------|
| 4.1 | حذف حساب + تصدير بيانات (GDPR-ready) | ⬜ |
| 4.2 | MFA للـ admin/owner | ⬜ |
| 4.3 | سياسة retention للبيانات الصحية | ⬜ |
| 4.4 | CI + tests (auth، دفع، مواعيد) | ⬜ |
| 4.5 | Sentry + monitoring | ⬜ |

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
