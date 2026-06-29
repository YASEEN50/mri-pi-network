-- Instant consult: platform credit, broadcast to specialty
ALTER TABLE "instant_consult_requests" ALTER COLUMN "doctorId" DROP NOT NULL;

ALTER TABLE "instant_consult_requests"
  ADD COLUMN IF NOT EXISTS "creditApplied" DECIMAL(10, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isBroadcast" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "targetSpecialization" TEXT;

CREATE INDEX IF NOT EXISTS "instant_consult_requests_isBroadcast_status_idx"
  ON "instant_consult_requests"("isBroadcast", "status");
