-- ============================================
-- Migration: 040_machine_extended_spec_fields.sql
-- Description: Extended Machine Technical Parameters (Tyre sizes, starter motor teeth, filter numbers, headgas kit notch)
-- ============================================

-- Add new technical spec columns to public.machines
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS front_tyre_size text,
  ADD COLUMN IF NOT EXISTS back_tyre_size text,
  ADD COLUMN IF NOT EXISTS starter_motor_teeth text,
  ADD COLUMN IF NOT EXISTS air_filter_no text,
  ADD COLUMN IF NOT EXISTS headgas_kit_notch text,
  ADD COLUMN IF NOT EXISTS diesel_filter_no text;

-- Create indexes for machine technical parameter lookups
CREATE INDEX IF NOT EXISTS idx_machines_front_tyre_size ON public.machines(front_tyre_size);
CREATE INDEX IF NOT EXISTS idx_machines_back_tyre_size ON public.machines(back_tyre_size);
CREATE INDEX IF NOT EXISTS idx_machines_air_filter_no ON public.machines(air_filter_no);
CREATE INDEX IF NOT EXISTS idx_machines_diesel_filter_no ON public.machines(diesel_filter_no);
