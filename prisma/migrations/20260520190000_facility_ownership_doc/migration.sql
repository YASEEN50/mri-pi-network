-- Facility ownership document (صك ملكية / عقد إيجار)
ALTER TABLE "facility_profiles" ADD COLUMN IF NOT EXISTS "ownershipDocUrl" TEXT;
