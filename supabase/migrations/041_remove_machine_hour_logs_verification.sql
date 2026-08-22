-- Migration 041: Remove verification status and verification process fields from machine_hour_logs
-- Drop verification columns from public.machine_hour_logs

ALTER TABLE public.machine_hour_logs
  DROP COLUMN IF EXISTS verification_status,
  DROP COLUMN IF EXISTS verified_by,
  DROP COLUMN IF EXISTS verified_at,
  DROP COLUMN IF EXISTS verification_remarks;

-- Drop index if exists
DROP INDEX IF EXISTS idx_machine_hour_logs_verification_status;
