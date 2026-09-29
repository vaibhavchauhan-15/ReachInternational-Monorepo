-- ==============================================================================
-- Migration 117: Standardize 4 Shifts (S1, S2, S3, S4) and Daily Log Aggregations
-- 1. Backfills shift_code and shift_scheduled_minutes on public.machine_hour_logs
--    (S1: Morning 06-12, S2: Afternoon 12-18, S3: Evening 18-24, S4: Night 00-06).
-- 2. Upserts active 4-shift codes (S1, S2, S3, S4) for all existing clients.
-- 3. Creates trigger function to auto-assign shift_code and scheduled minutes on insert/update.
-- ==============================================================================

-- 1. Backfill shift_code and shift_scheduled_minutes for existing machine_hour_logs
UPDATE public.machine_hour_logs
SET
  shift_code = CASE
    WHEN LOWER(COALESCE(shift, '')) LIKE '%night%' OR (start_time >= '00:00:00' AND start_time < '06:00:00') THEN 'S4'
    WHEN LOWER(COALESCE(shift, '')) LIKE '%morning%' OR (start_time >= '06:00:00' AND start_time < '12:00:00') THEN 'S1'
    WHEN LOWER(COALESCE(shift, '')) LIKE '%afternoon%' OR (start_time >= '12:00:00' AND start_time < '18:00:00') THEN 'S2'
    WHEN LOWER(COALESCE(shift, '')) LIKE '%evening%' OR (start_time >= '18:00:00') THEN 'S3'
    ELSE 'S1'
  END,
  shift_scheduled_minutes = COALESCE(shift_scheduled_minutes, 360)
WHERE shift_code IS NULL OR shift_scheduled_minutes IS NULL;

-- 2. Upsert standard 4-shift coverage (S1, S2, S3, S4) into public.client_shift_codes for all clients
INSERT INTO public.client_shift_codes (
  client_id,
  code,
  name,
  start_time,
  end_time,
  crosses_midnight,
  scheduled_minutes,
  normal_minutes,
  display_order,
  is_active
)
SELECT
  c.id AS client_id,
  s.code,
  s.name,
  s.start_time::time,
  s.end_time::time,
  s.crosses_midnight,
  s.scheduled_minutes,
  s.normal_minutes,
  s.display_order,
  true AS is_active
FROM public.clients c
CROSS JOIN (
  VALUES
    ('S1', 'Shift S1 (Morning)', '06:00:00', '12:00:00', false, 360, 360, 1),
    ('S2', 'Shift S2 (Afternoon)', '12:00:00', '18:00:00', false, 360, 360, 2),
    ('S3', 'Shift S3 (Evening)', '18:00:00', '23:59:00', false, 360, 360, 3),
    ('S4', 'Shift S4 (Night)', '00:00:00', '06:00:00', false, 360, 360, 4)
) AS s(code, name, start_time, end_time, crosses_midnight, scheduled_minutes, normal_minutes, display_order)
ON CONFLICT (client_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  crosses_midnight = EXCLUDED.crosses_midnight,
  scheduled_minutes = EXCLUDED.scheduled_minutes,
  normal_minutes = EXCLUDED.normal_minutes,
  display_order = EXCLUDED.display_order,
  is_active = true;

-- 3. Trigger function to auto-assign shift_code and shift_scheduled_minutes if omitted
CREATE OR REPLACE FUNCTION public.trg_fn_auto_set_machine_hour_log_shift_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.shift_code IS NULL OR TRIM(NEW.shift_code) = '' THEN
    IF LOWER(COALESCE(NEW.shift, '')) LIKE '%night%' OR (NEW.start_time >= '00:00:00' AND NEW.start_time < '06:00:00') THEN
      NEW.shift_code := 'S4';
    ELSIF LOWER(COALESCE(NEW.shift, '')) LIKE '%morning%' OR (NEW.start_time >= '06:00:00' AND NEW.start_time < '12:00:00') THEN
      NEW.shift_code := 'S1';
    ELSIF LOWER(COALESCE(NEW.shift, '')) LIKE '%afternoon%' OR (NEW.start_time >= '12:00:00' AND NEW.start_time < '18:00:00') THEN
      NEW.shift_code := 'S2';
    ELSIF LOWER(COALESCE(NEW.shift, '')) LIKE '%evening%' OR (NEW.start_time >= '18:00:00') THEN
      NEW.shift_code := 'S3';
    ELSE
      NEW.shift_code := 'S1';
    END IF;
  END IF;

  IF NEW.shift_scheduled_minutes IS NULL OR NEW.shift_scheduled_minutes <= 0 THEN
    NEW.shift_scheduled_minutes := 360;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_set_machine_hour_log_shift_code ON public.machine_hour_logs;
CREATE TRIGGER trg_auto_set_machine_hour_log_shift_code
  BEFORE INSERT OR UPDATE ON public.machine_hour_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_auto_set_machine_hour_log_shift_code();
