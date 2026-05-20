# Medical Platform — API (مرجع أساسي)

القاعدة: `https://your-domain.com`  
جميع الاستجابات الناجحة: `{ "success": true, "data": ... }`  
الأخطاء: `{ "success": false, "error": { "code", "message" } }`

المصادقة: جلسة NextAuth (Cookie) أو رؤوس الجلسة للطلبات من المتصفح.

---

## Auth

| Method | Path | الوصف |
|--------|------|--------|
| POST | `/api/auth/register` | تسجيل `{ email, password, role }` |
| POST | `/api/auth/[...nextauth]` | تسجيل الدخول (Credentials) |

---

## الأطباء

| Method | Path | Rate limit | الوصف |
|--------|------|------------|--------|
| GET | `/api/doctors` | 100/دقيقة/IP | بحث `?search=&city=&page=&limit=` |
| GET | `/api/doctors/:id` | — | تفاصيل طبيب |
| GET | `/api/doctors/:id/reviews` | — | قائمة التقييمات |

---

## التقييمات

| Method | Path | Rate limit | الوصف |
|--------|------|------------|--------|
| POST | `/api/reviews` | 20/دقيقة/IP | تقييم طبيب (CLIENT) |

**Body:**
```json
{
  "doctorId": "uuid",
  "appointmentId": "uuid",
  "rating": 1-5,
  "comment": "اختياري"
}
```

**شروط:**
- الموعد `status` = `COMPLETED`
- نفس `clientId` و `doctorId`
- تقييم واحد لكل موعد

---

## المواعيد

| Method | Path | الوصف |
|--------|------|--------|
| GET | `/api/appointments` | مواعيد المستخدم حسب الدور |
| POST | `/api/appointments` | حجز (CLIENT) `{ doctorId, type, scheduledAt, duration }` |
| PUT | `/api/appointments/:id/status` | تحديث الحالة |

---

## تحقق الطبيب (v2)

| Method | Path | Rate limit | الوصف |
|--------|------|------------|--------|
| POST | `/api/doctor/upload-license` | 5/دقيقة/طبيب | رفع رخصة `multipart` حقل `file` |
| POST | `/api/doctor/upload-face-v2` | — | صورة شخصية + هوية |
| POST | `/api/doctor/submit-verification` | — | إرسال للمراجعة البشرية |
| GET | `/api/doctor/verification-status` | — | حالة المسار و `pipelinePhase` |

**عامل OCR (داخلي):**
| POST | `/api/workers/ocr` | Header: `x-worker-secret` |

---

## الأدمن

| Method | Path | الوصف |
|--------|------|--------|
| GET | `/api/admin/verification` | قائمة انتظار قديمة `?status=WAITING` |
| GET | `/api/admin/verification-v2` | جلسات `PENDING_HUMAN` |
| POST | `/api/admin/review-v2` | `{ sessionId, decision: APPROVE\|REJECT, notes? }` |

---

## الإشعارات

| Method | Path | الوصف |
|--------|------|--------|
| GET | `/api/notifications` | إشعارات المستخدم |
| PATCH | `/api/notifications` | تحديد الكل كمقروء |
| PATCH | `/api/notifications/:id` | مقروء / حذف |

---

## المنشآت

| Method | Path | الوصف |
|--------|------|--------|
| GET | `/api/facilities` | بحث منشآت |
| GET/POST | `/api/facility/doctors` | أطباء المنشأة / ربط طبيب معتمد |

---

## رموز HTTP شائعة

| Code | المعنى |
|------|--------|
| 200 | نجاح |
| 201 | تم الإنشاء |
| 403 | غير مسموح (مثلاً موعد غير مكتمل للتقييم) |
| 409 | تعارض (تقييم مكرر) |
| 429 | تجاوز Rate limit — رأس `Retry-After` |

---

للنشر والمتغيرات: راجع [DEPLOYMENT.md](./DEPLOYMENT.md).
