-- Escrow: client credit for instant consult refunds
ALTER TABLE "client_profiles"
  ADD COLUMN IF NOT EXISTS "piCreditBalance" DECIMAL(12, 4) NOT NULL DEFAULT 0;

ALTER TABLE "instant_consult_requests"
  ADD COLUMN IF NOT EXISTS "transactionId" TEXT;
