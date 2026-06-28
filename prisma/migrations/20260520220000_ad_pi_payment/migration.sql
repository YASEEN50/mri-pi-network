-- Pi payment for paid advertisements (part 1: enum + columns)
-- Note: SET DEFAULT for PENDING_PAYMENT is in the next migration (PostgreSQL requires separate transactions)
ALTER TYPE "PaidAdStatus" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT' BEFORE 'PENDING_REVIEW';

CREATE TYPE "AdPlan" AS ENUM ('WEEKLY', 'MONTHLY');

ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'PAID_AD';

ALTER TABLE "paid_advertisements"
  ADD COLUMN IF NOT EXISTS "adPlan" "AdPlan" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN IF NOT EXISTS "piPaymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "piTxHash" TEXT,
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "requesterUserId" TEXT;
