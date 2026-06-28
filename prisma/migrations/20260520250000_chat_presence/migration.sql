-- Track which chat room a user is actively viewing (suppress in-room notifications).
CREATE TABLE "chat_presence" (
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_presence_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "chat_presence_roomId_idx" ON "chat_presence"("roomId");
