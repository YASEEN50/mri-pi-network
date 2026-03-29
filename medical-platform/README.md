# 🏥 Medical Platform

منصة طبية وعلمية متكاملة — Next.js 15 + PostgreSQL + Prisma + Pi Network

---

## 🚀 التثبيت السريع

```bash
git clone https://github.com/your-username/medical-platform.git
cd medical-platform
npm install
cp .env.example .env
# عدّل .env بقيمك
npx prisma migrate dev --name init
npx prisma generate
npm run db:seed
npm run dev
```

افتح http://localhost:3000

---

## ⚙️ المتطلبات

- Node.js 18.17+
- PostgreSQL 14+

---

## 🔐 حسابات الاختبار

| الدور | البريد | كلمة المرور |
|-------|--------|------------|
| Admin | admin@medical-platform.com | Admin@123456 |
| Client | client@test.com | Client@123456 |
| Doctor (معتمد) | doctor@test.com | Doctor@123456 |
| Doctor (قيد المراجعة) | doctor.pending@test.com | Doctor@123456 |
| Facility | facility@test.com | Facility@123456 |

---

## 🌐 Pi Network SDK

1. أنشئ تطبيقاً في [Pi Developer Portal](https://developers.minepi.com)
2. أضف في .env:
```env
PI_APP_ID="your-app-id"
PI_API_KEY="your-api-key"
PI_SANDBOX="true"
```

---

## 📁 هيكل المشروع

```
medical-platform/
├── prisma/                    # Schema + Seed
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Login, Register
│   │   ├── (onboarding)/      # اختيار الدور
│   │   ├── api/               # API Routes
│   │   ├── doctors/           # صفحات عامة
│   │   ├── facilities/
│   │   └── dashboard/         # لوحات التحكم
│   ├── core/                  # Business Logic
│   │   ├── domain/            # Entities + Value Objects
│   │   ├── use-cases/         # Use Cases
│   │   ├── interfaces/        # Ports (Repository interfaces)
│   │   └── errors/            # Result Pattern
│   ├── infrastructure/        # Prisma, R2, Pi SDK
│   ├── components/            # React Components
│   ├── hooks/                 # useAuth, useAppointments
│   ├── lib/                   # auth.ts, api-response.ts, validations/
│   ├── messages/              # ar.json, en.json
│   └── middleware.ts          # Route protection
├── .env.example
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

---

## 🔌 API Reference

### Auth
| POST | /api/auth/register | تسجيل بالبريد |
| POST | /api/auth/pi-login | تسجيل بـ Pi |

### Doctors
| GET/POST | /api/doctors | بحث + تسجيل |
| GET/PUT  | /api/doctors/:id | تفاصيل + تعديل |
| GET/POST | /api/doctors/:id/reviews | التقييمات |

### Facilities
| GET/POST | /api/facilities | بحث + تسجيل |
| GET      | /api/facilities/:id | تفاصيل |

### Appointments
| GET/POST | /api/appointments | مواعيد + حجز |
| PUT      | /api/appointments/:id/status | تحديث الحالة |

### Admin
| GET  | /api/admin/doctors/pending | أطباء قيد المراجعة |
| POST | /api/admin/doctors/:id/approve | موافقة/رفض |
| GET  | /api/admin/facilities/pending | منشآت قيد المراجعة |
| POST | /api/admin/facilities/:id/approve | موافقة/رفض |

---

## 📦 Storage

```env
STORAGE_PROVIDER="local"   # التطوير — ./uploads/
STORAGE_PROVIDER="r2"      # الإنتاج — Cloudflare R2
```

---

## 🚢 النشر على Vercel

```bash
vercel
# أضف متغيرات البيئة في لوحة Vercel
npx prisma migrate deploy
```

---

## 🛠️ أوامر مفيدة

```bash
npm run dev           # تشغيل التطوير
npm run build         # بناء الإنتاج
npm run typecheck     # فحص TypeScript
npm run db:studio     # Prisma Studio
npm run db:seed       # بيانات تجريبية
npm run db:reset      # إعادة تعيين DB
```

---

## 🔒 دورة موافقة الطبيب

```
PENDING → DOCUMENTS_REVIEW → APPROVED ✅
                           ↘ REJECTED ❌
```

---

MIT © Medical Platform
