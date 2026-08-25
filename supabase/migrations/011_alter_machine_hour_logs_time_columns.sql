-- ============================================
-- Migration 011: Indian Standard Time (IST - Asia/Kolkata) Configuration, Machine Hour Logs TIME WITHOUT TIME ZONE Conversion & Native Triggers
-- ============================================

-- 1. Set Database Timezone to Indian Standard Time (IST - Asia/Kolkata / UTC+5:30)
ALTER DATABASE postgres SET timezone TO 'Asia/Kolkata';

-- 2. Set default log_date expression explicitly to Indian Standard Time (Asia/Kolkata)
ALTER TABLE public.machine_hour_logs 
  ALTER COLUMN log_date SET DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date;

-- 3. Alter start_time and end_time columns to TIME WITHOUT TIME ZONE (casting to text before trimming to support pre-existing TIME or TEXT data types)
ALTER TABLE public.machine_hour_logs 
  ALTER COLUMN start_time TYPE TIME WITHOUT TIME ZONE USING NULLIF(TRIM(start_time::text), '')::TIME,
  ALTER COLUMN end_time TYPE TIME WITHOUT TIME ZONE USING NULLIF(TRIM(end_time::text), '')::TIME;

-- 4. Update Shift Overlap Prevention Function to use native TIME data types
CREATE OR REPLACE FUNCTION public.check_machine_hour_log_shift_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_overlap_count INT;
BEGIN
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF NEW.start_time = NEW.end_time THEN
      RAISE EXCEPTION 'Start time (%) and end time (%) cannot be identical', NEW.start_time, NEW.end_time;
    END IF;

    SELECT COUNT(*) INTO v_overlap_count
    FROM public.machine_hour_logs
    WHERE (operator_id = NEW.operator_id OR machine_id = NEW.machine_id)
      AND log_date = NEW.log_date
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND start_time IS NOT NULL
      AND end_time IS NOT NULL
      AND (
        (NEW.start_time >= start_time AND NEW.start_time < end_time) OR
        (NEW.end_time > start_time AND NEW.end_time <= end_time) OR
        (NEW.start_time <= start_time AND NEW.end_time >= end_time)
      );

    IF v_overlap_count > 0 THEN
      RAISE EXCEPTION 'An active log entry already overlaps with shift timings % - % on %', NEW.start_time, NEW.end_time, NEW.log_date;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Update Overtime Auto-Calculation Function to use native TIME data types
CREATE OR REPLACE FUNCTION public.auto_calculate_machine_hour_log_overtime()
RETURNS TRIGGER AS $$
DECLARE
  v_duration_hours NUMERIC;
BEGIN
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF NEW.end_time < NEW.start_time THEN
      v_duration_hours := ROUND(EXTRACT(EPOCH FROM ((NEW.end_time - NEW.start_time) + INTERVAL '24 hours')) / 3600.0, 2);
    ELSE
      v_duration_hours := ROUND(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0, 2);
    END IF;

    IF NEW.overtime_hours IS NULL OR NEW.overtime_hours = 0 THEN
      IF v_duration_hours > 8.0 THEN
        NEW.overtime_hours := v_duration_hours - 8.0;
      ELSE
        NEW.overtime_hours := 0.0;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
