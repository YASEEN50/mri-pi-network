-- Doctor withdrawal requests (piBalance → Pi wallet A2U)
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'FAILED');

ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'DOCTOR_WITHDRAWAL';

CREATE TABLE "withdrawal_requests" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(12,4) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "piUid" TEXT NOT NULL,
    "piUsername" TEXT,
    "piPaymentId" TEXT,
    "toAddress" TEXT,
    "txHash" TEXT,
    "transactionId" TEXT,
    "rejectionReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "withdrawal_requests_transactionId_key" ON "withdrawal_requests"("transactionId");
CREATE INDEX "withdrawal_requests_doctorId_idx" ON "withdrawal_requests"("doctorId");
CREATE INDEX "withdrawal_requests_userId_idx" ON "withdrawal_requests"("userId");
CREATE INDEX "withdrawal_requests_status_idx" ON "withdrawal_requests"("status");
CREATE INDEX "withdrawal_requests_createdAt_idx" ON "withdrawal_requests"("createdAt");

ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
