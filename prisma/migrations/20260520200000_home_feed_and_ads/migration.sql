-- PublicationType: add TIP
ALTER TYPE "PublicationType" ADD VALUE IF NOT EXISTS 'TIP';

-- Paid advertisements for home sidebar
CREATE TYPE "PaidAdStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'EXPIRED', 'REJECTED');
CREATE TYPE "PaidAdPlacement" AS ENUM ('HOME_SIDEBAR');

CREATE TABLE "paid_advertisements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "linkUrl" TEXT NOT NULL,
    "advertiserName" TEXT NOT NULL,
    "advertiserEmail" TEXT,
    "advertiserPhone" TEXT,
    "placement" "PaidAdPlacement" NOT NULL DEFAULT 'HOME_SIDEBAR',
    "status" "PaidAdStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_advertisements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "paid_advertisements_status_placement_sortOrder_idx" ON "paid_advertisements"("status", "placement", "sortOrder");
CREATE INDEX "paid_advertisements_startsAt_endsAt_idx" ON "paid_advertisements"("startsAt", "endsAt");
