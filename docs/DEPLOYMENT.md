# نشر Medical Platform على Vercel

## المتطلبات

- حساب [Vercel](https://vercel.com)
- قاعدة PostgreSQL (مُوصى: [Neon](https://neon.tech))
- مفاتيح الخدمات في `.env` (انظر `.env.example`)

## 1. ربط المستودع

1. ارفع المشروع إلى GitHub/GitLab.
2. في Vercel: **Add New Project** → اختر المستودع.
3. Framework: **Next.js** (يُكتشف تلقائياً).

## 2. متغيرات البيئة (Environment Variables)

أضف في Vercel → Settings → Environment Variables:

| المتغير | مطلوب | ملاحظات |
|---------|--------|---------|
| `DATABASE_URL` | نعم | رابط Neon **المُجمّع (pooler)** مع `?sslmode=require` |
| `DIRECT_URL` | نعم | رابط Neon **المباشر (بدون `-pooler`)** — مطلوب لـ `migrate deploy` |
| `NEXTAUTH_SECRET` | نعم | 32+ حرف عشوائي |
| `NEXTAUTH_URL` | نعم | `https://your-app.vercel.app` |
| `WORKER_SECRET` | نعم | لاستدعاء عمال OCR/face/fraud |
| `GOOGLE_CLOUD_VISION_API_KEY` | نعم | لاستخراج نص الرخصة |
| `RESEND_API_KEY` | نعم | للبريد والإشعارات |
| `EMAIL_FROM` | نعم | بريد مُوثّق في Resend |
| `AUDIT_LOG_SECRET` | نعم | 32+ حرف |
| `STORAGE_PROVIDER` | نعم | استخدم `r2` على Vercel (لا يوجد قرص محلي دائم) |
| `R2_*` | عند R2 | Cloudflare R2 للملفات |
| `UPSTASH_REDIS_REST_URL` | مُوصى | Rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | مُوصى | Rate limiting |
| `NEXT_PUBLIC_PI_SANDBOX` | Pi | `true` للاختبار (Testnet)، `false` للإنتاج |
| `PI_SANDBOX` | Pi | نفس قيمة `NEXT_PUBLIC_PI_SANDBOX` على الخادم |
| `PI_API_KEY` | Pi | مفتاح التطبيق من [Pi Developer Portal](https://develop.pi) |

### Pi Browser (التطبيق الكامل)

التطبيق مبني **للعمل داخل Pi Browser** عبر صفحات خفيفة (`pi-*.html`) متصلة بنفس الـ APIs:

| الصفحة | الوظيفة |
|--------|---------|
| `/pi-app.html` | الرئيسية بعد الدخول |
| `/pi-profile.html` | الملف الشخصي (تعديل + كلمة مرور) |
| `/pi-appointments.html` | المواعيد |
| `/pi-doctors.html` | البحث عن أطباء |
| `/pi-owner.html` | لوحة المؤسس/الأدمن |

المسارات `/profile`, `/dashboard`, `/doctors` تُوجّه تلقائياً إلى نسخ Pi (ما لم تُضف `?site=full`).

- **App URL** في Pi Portal: جذر النطاق فقط.
- **Development URL**: نفس رابط الإنتاج عند الاختبار من الهاتف.
- كوكيز الجلسة: `SameSite=None; Partitioned` (مُفعّلة في الإنتاج).
- حساب المؤسس/الأدمن: **الدخول بالبريد** (`pi-email.html`).

## 3. البناء (Build)

المشروع يستخدم:

```bash
npm run vercel-build
```

وهو ينفّذ:

1. `prisma generate`
2. `next build`

> **ملاحظة:** `prisma migrate deploy` **لا يُشغَّل تلقائياً** أثناء النشر على Vercel (تجنّب خطأ P1002 مع Neon).  
> عند تغيير `prisma/schema.prisma` شغّل الهجرة يدوياً **قبل** النشر:

```bash
# من جهازك (مع DIRECT_URL و DATABASE_URL في .env)
npm run db:migrate:prod
```

أو فعّل الهجرة في البناء مؤقتاً في Vercel:

- `buildCommand`: `npm run vercel-build:migrate`
- أو أضف `SKIP_MIGRATE_DEPLOY=1` إذا استخدمت `vercel-build:migrate` وفشل P1002 بدون تغييرات schema

### إعداد Neon (مهم لـ P1002)

| المتغير | مثال |
|---------|------|
| `DATABASE_URL` | `postgresql://...@ep-xxx-**pooler**.region.aws.neon.tech/neondb?sslmode=require` |
| `DIRECT_URL` | `postgresql://...@ep-xxx.region.aws.neon.tech/neondb?sslmode=require&connect_timeout=30` |

- `DIRECT_URL` **بدون** `-pooler` في اسم المضيف.
- من لوحة Neon: Connection string → **Direct connection** لـ `DIRECT_URL`.

## 4. التخزين على Vercel

- **لا تعتمد على** `.local-storage` في الإنتاج (ملفات مؤقتة تُحذف).
- عيّن `STORAGE_PROVIDER=r2` واملأ مفاتيح R2.
- بدون R2، رفع الرخصة قد ينجح لكن OCR لن يجد الملف.

## 5. Google Cloud Vision

1. فعّل [Cloud Vision API](https://console.cloud.google.com/apis/library/vision.googleapis.com).
2. أنشئ API Key (أو Service Account) وقيّده على Vision فقط.
3. أضف `GOOGLE_CLOUD_VISION_API_KEY` في Vercel.

مهلة OCR: **10 ثوانٍ** (مُضمّنة في الكود).

## 6. بعد النشر

- تحقق من `/api/doctors?limit=1`
- سجّل طبيباً وارفع رخصة (JPEG/PNG)
- راقب Logs في Vercel لـ `[ocr-worker]` و `[verification-pipeline]`
- لوحة الأدمن: `/admin/verification`

## 7. أوامر محلية

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

## 8. استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| فشل `migrate deploy` (P1002 / advisory lock) | أضف `DIRECT_URL` (رابط بدون pooler). النشر العادي لا يشغّل migrate — شغّله يدوياً عند تغيير schema. |
| فشل `migrate deploy` (عام) | تأكد من `DATABASE_URL` و`DIRECT_URL` وصلاحيات Neon |
| OCR لا يعمل | `GOOGLE_CLOUD_VISION_API_KEY` + `WORKER_SECRET` + `NEXTAUTH_URL` |
| 401 على workers | `x-worker-secret` يجب أن يطابق `WORKER_SECRET` |
| لا بريد | `RESEND_API_KEY` و `EMAIL_FROM` |
