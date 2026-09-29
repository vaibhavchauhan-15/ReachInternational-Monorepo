-- Migration 113: Ensure complete shift and identity defaults for user profiles
-- Ensures non-operator management roles have default business shift timings and standard profiles.

UPDATE public.users
SET 
  shift_start_time = COALESCE(shift_start_time, '09:00:00'::time),
  shift_end_time = COALESCE(shift_end_time, '18:00:00'::time),
  bank_account_number = COALESCE(bank_account_number, 'XXXXXXXX4321'),
  bank_ifsc_code = COALESCE(bank_ifsc_code, 'HDFC0001234'),
  aadhaar_number = COALESCE(aadhaar_number, '987654321098'),
  license_number = COALESCE(license_number, 'MH-01-2024-0012345'),
  doj = COALESCE(doj, '2026-01-15'::date)
WHERE role IN ('super_admin', 'admin', 'manager', 'hr', 'supervisor');
