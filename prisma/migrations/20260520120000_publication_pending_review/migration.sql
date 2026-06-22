-- AlterEnum: مراجعة المنشورات قبل النشر
ALTER TYPE "PublicationStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';
ALTER TYPE "PublicationStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
