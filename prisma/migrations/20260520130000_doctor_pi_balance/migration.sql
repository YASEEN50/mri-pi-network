-- رصيد Pi للطبيب (بعد خصم عمولة المنصة 5%)
ALTER TABLE "doctor_profiles" ADD COLUMN IF NOT EXISTS "piBalance" DECIMAL(12,4) NOT NULL DEFAULT 0;
