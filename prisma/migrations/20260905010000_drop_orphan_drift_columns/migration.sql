-- Completes the deferred half of 20260825140000_fix_schema_drift.
--
-- That migration deliberately skipped these two DROP COLUMNs because at the
-- time they held live production data. It said the decision was "deferred to a
-- follow-up migration"; this is that follow-up.
--
-- Neither column has existed in schema.prisma for some time, so every
-- `prisma migrate diff` against this chain re-proposed these same two drops,
-- and every module lane saw them appear in its own diff -- a standing trap,
-- since accepting them silently turns an additive lane migration into a
-- destructive one.
--
-- Safe now on two counts: the pre-wipe data these columns protected is
-- unrecoverable and gone, and both tables were verified empty (0 rows, so 0
-- non-null values in either column) before this was written.
ALTER TABLE "AutomationRule" DROP COLUMN "lastDueDateFiredAt";
ALTER TABLE "IntakeSubmission" DROP COLUMN "ipAddress";
