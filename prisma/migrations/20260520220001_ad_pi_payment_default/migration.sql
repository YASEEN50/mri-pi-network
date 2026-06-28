-- Pi payment for paid advertisements (part 2: default status)
-- Must run in a separate transaction after PENDING_PAYMENT enum value exists
ALTER TABLE "paid_advertisements" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';
