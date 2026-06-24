# Pi Browser — مسارات التطبيق و Next.js

> **المرحلة 2.3** — توحيد shell Pi مع تطبيق Next.js

---

## لماذا طبقتان؟

| الطبقة | متى | السبب |
|--------|-----|--------|
| **HTML ثابت** (`public/pi*.html`) | الدخول والتسجيل | Pi Developer Portal يتطلب **App URL = جذر النطاق** (`https://your-app.vercel.app`) بدون مسار. Middleware يعيد `/` → `pi.html`. |
| **Next.js** | كل ما بعد الدخول | حجز، دفع Pi، محادثة، لوحات تحكم — ميزة واحدة في الكود. |

---

## مسارات الدخول (ثابتة — لا تغيّر)

| URL للمستخدم | ملف فعلي | ملاحظة |
|--------------|----------|--------|
| `/` | `pi.html` | زر Pi + روابط بريد/تسجيل |
| `/login` | `pi-login.html` | نفس واجهة الدخول |
| `/register` | `pi-register.html` | إنشاء حساب |
| `/pi-email.html` | مباشر | دخول المؤسس/الأدمن بالبريد |

**استثناء:** أضف `?site=full` لتجاوز إعادة التوجيه واستخدام صفحات Next.js (`/login`, `/register`) — مفيد للتطوير في متصفح عادي.

---

## مسارات التطبيق (Next.js — المصدر الوحيد)

| الوظيفة | المسار |
|---------|--------|
| لوحة التحكم (حسب الدور) | `/dashboard` |
| مواعيد العميل | `/dashboard/client/appointments` |
| جدول الطبيب | `/dashboard/doctor/schedule` |
| المنشأة | `/dashboard/facility/overview` |
| الأطباء / حجز | `/doctors`, `/doctors/[id]` |
| المحادثات | `/dashboard/client/chat`, `/dashboard/doctor/chat` |
| الملف | `/profile` |
| اختيار الدور | `/select-role` |
| Owner / Admin | `/owner`, `/dashboard/admin/verification` |

الخريطة البرمجية: `src/lib/pi/pi-routes.ts`  
API للعميل: `GET /api/pi-config` → `{ appShell: "nextjs", routes: {...} }`

---

## صفحات pi-*.html القديمة (إعادة توجيه)

هذه الصفحات **لم تعد shell مستقل** — تُوجّه فوراً إلى Next.js:

| قديم | جديد |
|------|------|
| `pi-doctors.html` | `/doctors` |
| `pi-doctor.html?id=` | `/doctors/[id]` |
| `pi-appointments.html` | `/dashboard` |
| `pi-profile.html` | `/profile` |
| `pi-owner.html` | `/dashboard` |
| `pi-dashboard.html` | `/dashboard` |
| `pi-select-role.html` | `/select-role` |

`pi-app.html` — قائمة مختصرة تربط مباشرة بمسارات Next.js (بدون نسخ واجهات).

`pi-shell.js` — روابط التنقل تشير إلى Next.js (للصفحات التي ما زالت تستخدمه).

---

## Pi Portal — إعدادات مطلوبة

1. **App URL:** `https://mri-yaseen2.vercel.app` (جذر فقط، بدون `/pi.html`)
2. **Scopes:** `username`, `payments`
3. **Vercel env:** `PI_API_KEY`, `NEXT_PUBLIC_PI_SANDBOX=false` (production)

---

## تدفق المستخدم في Pi Browser

```
/ (pi.html)
  → Pi.authenticate → جلسة NextAuth
  → /dashboard (Next.js)
  → /doctors → حجز → دفع Pi → /dashboard/client/appointments
```

---

## للمطورين

- **لا تضف** ميزات جديدة في `pi-*.html` ما عدا الدخول.
- **عدّل** `src/lib/pi/pi-routes.ts` عند إضافة مسار رئيسي جديد.
- **زامن** `public/pi-shell.js` إن بقي مستخدماً (نفس منطق `dashboardPath`).
- اختبار Pi: افتح `/` داخل Pi Browser، أو `/login?site=full` في Chrome للواجهة React.
