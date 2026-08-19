-- ============================================
-- Migration: 009_machine_extended_details.sql
-- Description: Extended Machine Technical Specs, Compliance Tracking & Status Update
-- ============================================

-- Add technical & compliance columns to public.machines
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS year_of_mfg text,
  ADD COLUMN IF NOT EXISTS engine_serial_no text,
  ADD COLUMN IF NOT EXISTS engine_mot_no text,
  ADD COLUMN IF NOT EXISTS insurance_policy_no text,
  ADD COLUMN IF NOT EXISTS insurance_expiry_date date,
  ADD COLUMN IF NOT EXISTS third_party_certificate text,
  ADD COLUMN IF NOT EXISTS third_party_expiry_date date,
  ADD COLUMN IF NOT EXISTS rto_tax text,
  ADD COLUMN IF NOT EXISTS rto_tax_expiry_date date;

-- Update status check constraint on public.machines to support 'on_rent' and 'under_maintenance'
ALTER TABLE public.machines DROP CONSTRAINT IF EXISTS machines_status_check;

ALTER TABLE public.machines
  ADD CONSTRAINT machines_status_check
  CHECK (status IN ('active', 'inactive', 'on_rent', 'under_maintenance'));

-- Indexes for compliance expiry tracking
CREATE INDEX IF NOT EXISTS idx_machines_serial_number ON public.machines(serial_number);
CREATE INDEX IF NOT EXISTS idx_machines_manufacturer ON public.machines(manufacturer);
CREATE INDEX IF NOT EXISTS idx_machines_insurance_expiry ON public.machines(insurance_expiry_date);
CREATE INDEX IF NOT EXISTS idx_machines_third_party_expiry ON public.machines(third_party_expiry_date);
CREATE INDEX IF NOT EXISTS idx_machines_rto_tax_expiry ON public.machines(rto_tax_expiry_date);
