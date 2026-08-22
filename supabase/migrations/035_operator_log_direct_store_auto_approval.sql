-- Migration: 035_operator_log_direct_store_auto_approval.sql
-- Description: Set default verification_status to 'approved' for machine_hour_logs so submitted logs store directly into database without requiring approval

ALTER TABLE public.machine_hour_logs 
  ALTER COLUMN verification_status SET DEFAULT 'approved';

-- Update existing pending or submitted logs to approved
UPDATE public.machine_hour_logs 
SET 
  verification_status = 'approved',
  verified_at = COALESCE(verified_at, NOW())
WHERE verification_status IN ('pending', 'submitted');
