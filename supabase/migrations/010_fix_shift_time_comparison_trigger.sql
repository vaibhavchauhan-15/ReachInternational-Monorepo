-- ============================================
-- Migration 010: Fix check_machine_hour_log_shift_overlap & auto_calculate_machine_hour_log_overtime Trigger Time Type Comparisons
-- ============================================

CREATE OR REPLACE FUNCTION public.check_machine_hour_log_shift_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_new_start_time TIME;
  v_new_end_time TIME;
  v_overlap_count INT;
BEGIN
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL AND TRIM(NEW.start_time) <> '' AND TRIM(NEW.end_time) <> '' THEN
    BEGIN
      v_new_start_time := NEW.start_time::TIME;
      v_new_end_time := NEW.end_time::TIME;
    EXCEPTION WHEN OTHERS THEN
      RETURN NEW;
    END;

    IF v_new_start_time = v_new_end_time THEN
      RAISE EXCEPTION 'Start time (%) and end time (%) cannot be identical', NEW.start_time, NEW.end_time;
    END IF;

    SELECT COUNT(*) INTO v_overlap_count
    FROM public.machine_hour_logs
    WHERE (operator_id = NEW.operator_id OR machine_id = NEW.machine_id)
      AND log_date = NEW.log_date
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND start_time IS NOT NULL
      AND end_time IS NOT NULL
      AND TRIM(start_time) <> ''
      AND TRIM(end_time) <> ''
      AND (
        (v_new_start_time >= start_time::TIME AND v_new_start_time < end_time::TIME) OR
        (v_new_end_time > start_time::TIME AND v_new_end_time <= end_time::TIME) OR
        (v_new_start_time <= start_time::TIME AND v_new_end_time >= end_time::TIME)
      );

    IF v_overlap_count > 0 THEN
      RAISE EXCEPTION 'An active log entry already overlaps with shift timings % - % on %', NEW.start_time, NEW.end_time, NEW.log_date;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.auto_calculate_machine_hour_log_overtime()
RETURNS TRIGGER AS $$
DECLARE
  v_start_t TIME;
  v_end_t TIME;
  v_duration_hours NUMERIC;
BEGIN
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL AND TRIM(NEW.start_time) <> '' AND TRIM(NEW.end_time) <> '' THEN
    BEGIN
      v_start_t := NEW.start_time::TIME;
      v_end_t := NEW.end_time::TIME;
    EXCEPTION WHEN OTHERS THEN
      RETURN NEW;
    END;

    IF v_end_t < v_start_t THEN
      v_duration_hours := ROUND(EXTRACT(EPOCH FROM ((v_end_t - v_start_t) + INTERVAL '24 hours')) / 3600.0, 2);
    ELSE
      v_duration_hours := ROUND(EXTRACT(EPOCH FROM (v_end_t - v_start_t)) / 3600.0, 2);
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

