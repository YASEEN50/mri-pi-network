-- Add REFERRAL_REWARD transaction type for doctor referral Pi rewards
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'REFERRAL_REWARD';
