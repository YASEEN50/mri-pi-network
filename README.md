# Medical Platform

منصة طبية متكاملة — Next.js 15 · PostgreSQL · Prisma · Pi Network · Google Cloud Vision

---

## التثبيت السريع

```bash
git clone https://github.com/your-username/medical-platform.git
cd medical-platform
npm install
cp .env.example .env
# عدّل .env (قاعدة البيانات، Vision، Resend، Upstash، R2)
npx prisma migrate dev
npm run db:seed
npm run dev
```

افتح http://localhost:3000

---

## المتطلبات

- Node.js 18.17+
- PostgreSQL 14+ (مُوصى: Neon)
- [Google Cloud Vision API](https://console.cloud.google.com/apis/library/vision.googleapis.com) — استخراج نص الرخصة (مهلة 10 ثوانٍ)
- [Resend](https://resend.com) — البريد والإشعارات
- [Upstash Redis](https://upstash.com) — Rate limiting (اختياري؛ يعمل fallback في الذاكرة)
- Cloudflare R2 — للتخزين في الإنتاج على Vercel

---

## حسابات الاختبار

بعد تشغيل `npm run db:seed` تُنشأ حسابات تطوير محلية. **لا تستخدمها في الإنتاج.**

| الدور | البريد الإلكتروني |
|-------|-------------------|
| Owner | `owner@medical-platform.com` |
| Admin | `admin@medical-platform.com` |
| Client | `client@test.com` |
| Doctor (موثّق) | `doctor@test.com` |
| Doctor (معلق) | `doctor.pending@test.com` |
| Facility | `facility@test.com` |

كلمات المرور الافتراضية للتطوير تُطبع في الطرفية عند تشغيل الـ seed (راجع `prisma/seed.ts` محلياً فقط).

---

### استخراج نص الرخصة (Google Cloud Vision)

- استبدال Tesseract بـ **Google Cloud Vision API**
- مهلة ثابتة **10 ثوانٍ** لكل صورة
- متغير: `GOOGLE_CLOUD_VISION_API_KEY`

### نظام الإشعارات (Resend + واجهة)

| الحدث | المستلم | القناة |
|-------|---------|--------|
| اكتمال التحقق الآلي | الطبيب | بريد + إشعار داخل التطبيق |
| طبيب جديد للمراجعة | الأدمن | إشعار واجهة |
| موافقة الأدمن | الطبيب + المنشآت المرتبطة | بريد + إشعار |

أيقونة الجرس في الشريط العلوي (`NotificationBell`).

### صفحة التقييمات

- `/doctors/[id]/reviews` — نجوم، توزيع، مراجعات مع ترقيم
- `POST /api/reviews` — يتطلب موعداً **مكتملاً** (`COMPLETED`) مع نفس الطبيب
- ضغط الصور قبل الرفع (`browser-image-compression`)

### Rate limiting (Upstash)

| المسار | الحد |
|--------|------|
| `GET /api/doctors` | 100 / دقيقة / IP |
| `POST /api/reviews` | 20 / دقيقة / IP |
| `POST /api/doctor/upload-license` | 5 / دقيقة / طبيب |

```env
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
```

---

## النشر على Vercel مع R2

1. اربط المستودع في Vercel.
2. أضف متغيرات البيئة من `.env.example`.
3. **مهم:** `STORAGE_PROVIDER=r2` — لا تستخدم `local` على Vercel.
4. `NEXTAUTH_URL` = رابط الإنتاج.
5. `WORKER_SECRET` + `GOOGLE_CLOUD_VISION_API_KEY` للتحقق الآلي.

```bash
npm run vercel-build   # prisma generate + migrate deploy + next build
```

دليل مفصل: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)  
مرجع API: [docs/API.md](docs/API.md)

---

## هيكل المشروع

```
medical-platform/
├── prisma/
├── docs/
│   ├── DEPLOYMENT.md
│   └── API.md
├── src/
│   ├── app/api/           # REST API
│   ├── lib/
│   │   ├── verification/  # Vision OCR + lifecycle
│   │   ├── notifications/
│   │   ├── upstash-rate-limit.ts
│   │   └── client/image-compress.ts
│   └── components/
├── vercel.json
└── .env.example
```

---

## دورة تحقق الطبيب (v2)

```
PENDING_AI → رفع الرخصة → LICENSE_UPLOADED (Vision OCR)
→ التحقق من الوجه/الاحتيال → PENDING_HUMAN → موافقة الأدمن → APPROVED
```

---

## أوامر مفيدة

```bash
npm run dev
npm run build
npm run vercel-build
npm run typecheck
npm run test:e2e
npm run db:studio
npm run db:seed
```

---

MIT © Medical Platform
