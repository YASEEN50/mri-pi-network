-- CreateEnum
CREATE TYPE "InstantConsultStatus" AS ENUM ('AWAITING_PAYMENT', 'PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'INSTANT_CONSULT';

-- AlterTable
ALTER TABLE "doctor_profiles" ADD COLUMN "acceptsInstantConsult" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "doctor_profiles" ADD COLUMN "isOnlineForInstant" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "doctor_profiles" ADD COLUMN "instantConsultFee" DECIMAL(10,4);
ALTER TABLE "doctor_profiles" ADD COLUMN "instantConsultDurationMinutes" INTEGER NOT NULL DEFAULT 15;

-- CreateTable
CREATE TABLE "instant_consult_requests" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "status" "InstantConsultStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "reason" TEXT,
    "fee" DECIMAL(10,4) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "sessionEndsAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "chatRoomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instant_consult_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instant_consult_requests_doctorId_status_idx" ON "instant_consult_requests"("doctorId", "status");
CREATE INDEX "instant_consult_requests_clientId_status_idx" ON "instant_consult_requests"("clientId", "status");
CREATE INDEX "instant_consult_requests_expiresAt_idx" ON "instant_consult_requests"("expiresAt");

-- AddForeignKey
ALTER TABLE "instant_consult_requests" ADD CONSTRAINT "instant_consult_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "instant_consult_requests" ADD CONSTRAINT "instant_consult_requests_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
