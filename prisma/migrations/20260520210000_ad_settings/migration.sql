-- Ad pricing settings + review fields on paid advertisements
ALTER TABLE "paid_advertisements"
  ADD COLUMN IF NOT EXISTS "pricePi" DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS "durationDays" INTEGER,
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ad_settings" (
    "id" TEXT NOT NULL,
    "sidebarWeeklyPricePi" DECIMAL(10,4) NOT NULL DEFAULT 10,
    "sidebarMonthlyPricePi" DECIMAL(10,4) NOT NULL DEFAULT 25,
    "defaultDurationDays" INTEGER NOT NULL DEFAULT 30,
    "isAcceptingRequests" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_settings_pkey" PRIMARY KEY ("id")
);
