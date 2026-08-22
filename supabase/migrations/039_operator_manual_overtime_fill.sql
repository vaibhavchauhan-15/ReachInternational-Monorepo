-- Migration: 039_operator_manual_overtime_fill.sql
-- Description: Drop trigger trg_auto_calculate_machine_hour_log_overtime so overtime_hours is manually filled by operators.

DROP TRIGGER IF EXISTS trg_auto_calculate_machine_hour_log_overtime ON public.machine_hour_logs;

CREATE OR REPLACE FUNCTION public.auto_calculate_machine_hour_log_overtime()
RETURNS TRIGGER AS $$
BEGIN
  -- Preserve manually entered overtime_hours.
  -- Default to 0 if overtime_hours is NULL.
  IF NEW.overtime_hours IS NULL THEN
    NEW.overtime_hours := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
