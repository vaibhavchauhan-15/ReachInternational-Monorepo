-- Migration: 037_operator_overtime_auto_calc.sql
-- Description: Automatically calculate overtime_hours based on start_time and end_time (standard shift = 8 hours).

-- 1. Helper function to compute overtime hours from start_time and end_time
CREATE OR REPLACE FUNCTION public.calculate_overtime_hours(start_t TEXT, end_t TEXT)
RETURNS NUMERIC AS $$
DECLARE
  s_mins INT;
  e_mins INT;
  diff_mins INT;
  dur_hours NUMERIC;
  ot_hours NUMERIC;
BEGIN
  s_mins := public.parse_time_to_minutes(start_t);
  e_mins := public.parse_time_to_minutes(end_t);

  IF s_mins IS NULL OR e_mins IS NULL THEN
    RETURN 0;
  END IF;

  diff_mins := e_mins - s_mins;
  IF diff_mins < 0 THEN
    -- Overnight shift adjustment (e.g. 10:00 PM to 12:00 AM, 10:00 PM to 06:00 AM)
    diff_mins := diff_mins + 1440;
  END IF;

  IF diff_mins <= 0 THEN
    RETURN 0;
  END IF;

  dur_hours := round((diff_mins::numeric / 60.0), 1);
  ot_hours := GREATEST(0, round((dur_hours - 8.0), 1));

  RETURN ot_hours;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Trigger function to auto-set overtime_hours BEFORE INSERT OR UPDATE on public.machine_hour_logs
CREATE OR REPLACE FUNCTION public.auto_calculate_machine_hour_log_overtime()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    NEW.overtime_hours := public.calculate_overtime_hours(NEW.start_time, NEW.end_time);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_calculate_machine_hour_log_overtime ON public.machine_hour_logs;

CREATE TRIGGER trg_auto_calculate_machine_hour_log_overtime
  BEFORE INSERT OR UPDATE ON public.machine_hour_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_calculate_machine_hour_log_overtime();

-- 3. Update existing records in machine_hour_logs so overtime_hours matches start_time and end_time
UPDATE public.machine_hour_logs
SET overtime_hours = public.calculate_overtime_hours(start_time, end_time)
WHERE start_time IS NOT NULL AND end_time IS NOT NULL;
