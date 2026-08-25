-- ============================================
-- Migration 004: Create public.machine_hour_logs (Operation Logs), shift integrity, overtime triggers, RLS, and indexes
-- ============================================

-- 1. MACHINE HOUR LOGS TABLE (Operation Logs)
CREATE TABLE IF NOT EXISTS public.machine_hour_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- Links to existing User UUID (role = 'operator')
  supervisor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,     -- Links to existing User UUID (role = 'supervisor')
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,         -- Links to existing Client UUID
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME WITHOUT TIME ZONE,
  end_time TIME WITHOUT TIME ZONE,
  start_meter NUMERIC NOT NULL DEFAULT 0,
  end_meter NUMERIC NOT NULL DEFAULT 0,
  running_hours NUMERIC GENERATED ALWAYS AS (end_meter - start_meter) STORED,
  overtime_hours NUMERIC NOT NULL DEFAULT 0,
  is_breakdown BOOLEAN NOT NULL DEFAULT FALSE,
  location TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if public.machine_hour_logs pre-existed with an older schema
ALTER TABLE public.machine_hour_logs 
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_breakdown BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS remarks TEXT;

-- 2. Shift Overlap Prevention Function & Trigger
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

DROP TRIGGER IF EXISTS trg_check_machine_hour_log_shift_overlap ON public.machine_hour_logs;
CREATE TRIGGER trg_check_machine_hour_log_shift_overlap
  BEFORE INSERT OR UPDATE ON public.machine_hour_logs
  FOR EACH ROW EXECUTE FUNCTION public.check_machine_hour_log_shift_overlap();

-- 3. Overtime Auto-Calculation Function & Trigger
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

DROP TRIGGER IF EXISTS trg_auto_calculate_machine_hour_log_overtime ON public.machine_hour_logs;
CREATE TRIGGER trg_auto_calculate_machine_hour_log_overtime
  BEFORE INSERT OR UPDATE ON public.machine_hour_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_calculate_machine_hour_log_overtime();

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_machine_id ON public.machine_hour_logs(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_operator_id ON public.machine_hour_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_supervisor_id ON public.machine_hour_logs(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_client_id ON public.machine_hour_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_machine_date ON public.machine_hour_logs(machine_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_operator_date ON public.machine_hour_logs(operator_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_meters ON public.machine_hour_logs(machine_id, start_meter, end_meter);

-- 5. ROW LEVEL SECURITY & POLICIES
ALTER TABLE public.machine_hour_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read machine_hour_logs" ON public.machine_hour_logs;
CREATE POLICY "Allow authenticated read machine_hour_logs" ON public.machine_hour_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated write machine_hour_logs" ON public.machine_hour_logs;
CREATE POLICY "Allow authenticated write machine_hour_logs" ON public.machine_hour_logs
  FOR ALL TO authenticated USING (true);
