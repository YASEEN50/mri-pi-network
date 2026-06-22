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

## 3. البناء (Build)

المشروع يستخدم:

```bash
npm run vercel-build
```

وهو ينفّذ:

1. `prisma generate`
2. `prisma migrate deploy`
3. `next build`

ملف `vercel.json` يحدد `buildCommand` ومهل الـ API routes للعمال.

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
| فشل `migrate deploy` (P1002 / advisory lock) | أضف `DIRECT_URL` (رابط بدون pooler). لا تشغّل نشرين متزامنين. |
| فشل `migrate deploy` (عام) | تأكد من `DATABASE_URL` و`DIRECT_URL` وصلاحيات Neon |
| OCR لا يعمل | `GOOGLE_CLOUD_VISION_API_KEY` + `WORKER_SECRET` + `NEXTAUTH_URL` |
| 401 على workers | `x-worker-secret` يجب أن يطابق `WORKER_SECRET` |
| لا بريد | `RESEND_API_KEY` و `EMAIL_FROM` |
