-- AlterTable
ALTER TABLE "verification_documents" ADD COLUMN "forensicsScore" INTEGER;
ALTER TABLE "verification_documents" ADD COLUMN "forensicsSignals" JSONB;

-- CreateIndex
CREATE INDEX "verification_documents_forensicsScore_idx" ON "verification_documents"("forensicsScore");
