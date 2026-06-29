-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'VERIFICATION_ASSIGNED';
ALTER TYPE "ActivityType" ADD VALUE 'VERIFICATION_INTERNAL_NOTE';

-- AlterTable
ALTER TABLE "verification_sessions" ADD COLUMN "assignedToId" TEXT;
ALTER TABLE "verification_sessions" ADD COLUMN "assignedAt" TIMESTAMP(3);
ALTER TABLE "verification_sessions" ADD COLUMN "assignedById" TEXT;

-- CreateTable
CREATE TABLE "verification_session_notes" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_session_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_sessions_assignedToId_idx" ON "verification_sessions"("assignedToId");
CREATE INDEX "verification_sessions_currentState_assignedToId_idx" ON "verification_sessions"("currentState", "assignedToId");
CREATE INDEX "verification_session_notes_sessionId_createdAt_idx" ON "verification_session_notes"("sessionId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "verification_sessions" ADD CONSTRAINT "verification_sessions_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "verification_sessions" ADD CONSTRAINT "verification_sessions_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "verification_session_notes" ADD CONSTRAINT "verification_session_notes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "verification_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "verification_session_notes" ADD CONSTRAINT "verification_session_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
