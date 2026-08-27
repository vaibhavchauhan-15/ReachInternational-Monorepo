-- Migration 013: Add PostgreSQL Check Constraints for Hour Meter & Clipboard Input Security
-- ReachInternational Production Security Layer

-- 1. Ensure end_meter is never less than start_meter in public.machine_hour_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_machine_hour_logs_meter_range'
  ) THEN
    ALTER TABLE public.machine_hour_logs
    ADD CONSTRAINT chk_machine_hour_logs_meter_range
    CHECK (end_meter >= start_meter);
  END IF;
END $$;

-- 2. Ensure starting and ending meter readings are non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_machine_hour_logs_start_meter_positive'
  ) THEN
    ALTER TABLE public.machine_hour_logs
    ADD CONSTRAINT chk_machine_hour_logs_start_meter_positive
    CHECK (start_meter >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_machine_hour_logs_end_meter_positive'
  ) THEN
    ALTER TABLE public.machine_hour_logs
    ADD CONSTRAINT chk_machine_hour_logs_end_meter_positive
    CHECK (end_meter >= 0);
  END IF;
END $$;

-- 3. Ensure hour_meter on machines table is non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_machines_hour_meter_positive'
  ) THEN
    ALTER TABLE public.machines
    ADD CONSTRAINT chk_machines_hour_meter_positive
    CHECK (hour_meter >= 0);
  END IF;
END $$;
