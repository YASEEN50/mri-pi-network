-- MFA fields for admin/owner TOTP
ALTER TABLE "users" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "users" ADD COLUMN "mfaBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
