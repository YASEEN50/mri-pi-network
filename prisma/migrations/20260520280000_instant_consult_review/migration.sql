-- AlterTable
ALTER TABLE "reviews" ADD COLUMN "instantConsultId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "reviews_instantConsultId_key" ON "reviews"("instantConsultId");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_instantConsultId_fkey" FOREIGN KEY ("instantConsultId") REFERENCES "instant_consult_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
