-- Migration: 036_operator_multi_shift_non_overlap.sql
-- Description: Enforce multi-shift log integrity and prevent overlapping shift time entries for machine_hour_logs.

-- 1. Index for operator log date queries
CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_operator_date
  ON public.machine_hour_logs (operator_id, log_date DESC);

-- 2. Helper function to parse HH:MM AM/PM or 24-hour time strings to total minutes from 00:00
CREATE OR REPLACE FUNCTION public.parse_time_to_minutes(t TEXT)
RETURNS INTEGER AS $$
DECLARE
  clean_t TEXT;
  parts TEXT[];
  hh INT;
  mm INT;
  ampm TEXT;
BEGIN
  IF t IS NULL OR trim(t) = '' THEN
    RETURN NULL;
  END IF;
  clean_t := upper(trim(t));
  
  IF clean_t LIKE '%AM' OR clean_t LIKE '%PM' THEN
    ampm := CASE WHEN clean_t LIKE '%PM' THEN 'PM' ELSE 'AM' END;
    clean_t := trim(replace(replace(clean_t, 'AM', ''), 'PM', ''));
    parts := regexp_split_to_array(clean_t, ':');
    IF array_length(parts, 1) < 2 THEN
      RETURN NULL;
    END IF;
    hh := parts[1]::INT;
    mm := parts[2]::INT;
    IF ampm = 'PM' AND hh < 12 THEN
      hh := hh + 12;
    ELSIF ampm = 'AM' AND hh = 12 THEN
      hh := 0;
    END IF;
  ELSE
    parts := regexp_split_to_array(clean_t, ':');
    IF array_length(parts, 1) < 2 THEN
      RETURN NULL;
    END IF;
    hh := parts[1]::INT;
    mm := parts[2]::INT;
  END IF;
  
  RETURN (hh * 60) + mm;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Trigger function to validate shift non-overlap
CREATE OR REPLACE FUNCTION public.check_machine_hour_log_shift_overlap()
RETURNS TRIGGER AS $$
DECLARE
  rec RECORD;
  new_s INT;
  new_e INT;
  ex_s INT;
  ex_e INT;
BEGIN
  new_s := public.parse_time_to_minutes(NEW.start_time);
  new_e := public.parse_time_to_minutes(NEW.end_time);

  IF new_s IS NOT NULL AND new_e IS NOT NULL THEN
    IF new_e <= new_s THEN
      new_e := new_e + 1440;
    END IF;
  END IF;

  FOR rec IN 
    SELECT id, shift, start_time, end_time, log_date
    FROM public.machine_hour_logs
    WHERE (machine_id = NEW.machine_id OR operator_id = NEW.operator_id)
      AND log_date = NEW.log_date
      AND id IS DISTINCT FROM NEW.id
  LOOP
    -- Check matching predefined shift name (e.g. shift_1, shift_2, shift_3)
    IF NEW.shift IS NOT NULL AND rec.shift IS NOT NULL 
       AND NEW.shift NOT IN ('custom', 'general', 'day')
       AND NEW.shift = rec.shift THEN
      RAISE EXCEPTION 'Shift overlap: A log entry for shift "%" already exists on date %.', 
        NEW.shift, NEW.log_date 
        USING ERRCODE = '23P01';
    END IF;

    -- Check time interval overlap if both entries have valid start_time and end_time
    IF new_s IS NOT NULL AND new_e IS NOT NULL THEN
      ex_s := public.parse_time_to_minutes(rec.start_time);
      ex_e := public.parse_time_to_minutes(rec.end_time);

      IF ex_s IS NOT NULL AND ex_e IS NOT NULL THEN
        IF ex_e <= ex_s THEN
          ex_e := ex_e + 1440;
        END IF;

        IF GREATEST(new_s, ex_s) < LEAST(new_e, ex_e) THEN
          RAISE EXCEPTION 'Shift time overlap: Selected period (% - %) overlaps with existing log (% - %) on date %.',
            NEW.start_time, NEW.end_time, rec.start_time, rec.end_time, NEW.log_date
            USING ERRCODE = '23P01';
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_machine_hour_log_shift_overlap ON public.machine_hour_logs;

CREATE TRIGGER trg_check_machine_hour_log_shift_overlap
  BEFORE INSERT OR UPDATE ON public.machine_hour_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_machine_hour_log_shift_overlap();
