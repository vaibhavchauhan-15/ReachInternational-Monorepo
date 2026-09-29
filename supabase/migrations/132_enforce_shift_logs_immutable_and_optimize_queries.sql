-- Migration 132: Enforce machine hour logs immutability, resilient site filtering, and query optimization indexes
-- Applied to Development Project (vlmxciuogczumumrwyot)

-- 1. Backfill any null location records for assigned clients before attaching immutability trigger
UPDATE public.machine_hour_logs mhl
SET location = COALESCE(NULLIF(btrim(c.street), ''), NULLIF(btrim(c.city), ''), 'Main Site')
FROM public.machines m
LEFT JOIN public.clients c ON c.id = m.client_id
WHERE mhl.machine_id = m.id
  AND (mhl.location IS NULL OR btrim(mhl.location) = '');

UPDATE public.machine_hour_logs
SET location = 'Main Site'
WHERE location IS NULL OR btrim(location) = '';

-- 2. Create immutability enforcement trigger function
CREATE OR REPLACE FUNCTION public.enforce_machine_hour_logs_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Shift logs are strictly immutable and cannot be deleted by any role.'
      USING ERRCODE = '23514';
  ELSIF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Shift logs are strictly immutable and cannot be modified by any role.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

-- 3. Attach trigger on public.machine_hour_logs
DROP TRIGGER IF EXISTS trg_enforce_machine_hour_logs_immutable ON public.machine_hour_logs;
CREATE TRIGGER trg_enforce_machine_hour_logs_immutable
  BEFORE UPDATE OR DELETE ON public.machine_hour_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_machine_hour_logs_immutable();

-- 4. Drop existing UPDATE and DELETE RLS policies
DROP POLICY IF EXISTS super_admin_delete_machine_hour_logs ON public.machine_hour_logs;
DROP POLICY IF EXISTS update_machine_hour_logs ON public.machine_hour_logs;

-- 5. Add high-performance composite indexes
CREATE INDEX IF NOT EXISTS idx_mhl_client_machine_date 
  ON public.machine_hour_logs (client_id, machine_id, log_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mhl_client_location_date 
  ON public.machine_hour_logs (client_id, location, log_date DESC);

-- 6. Upgrade get_operations_summary RPC with resilient multi-part site matching & total_working_hours
CREATE OR REPLACE FUNCTION public.get_operations_summary(
  p_client_id uuid DEFAULT NULL::uuid, 
  p_machine_id uuid DEFAULT NULL::uuid, 
  p_operator_id uuid DEFAULT NULL::uuid, 
  p_site text DEFAULT NULL::text, 
  p_start_date date DEFAULT NULL::date, 
  p_end_date date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_run_hours numeric := 0;
  v_ot_hours numeric := 0;
  v_working_hours numeric := 0;
  v_breakdowns bigint := 0;
  v_days bigint := 0;
  v_total_logs bigint := 0;
  v_site_clean text := NULL;
BEGIN
  IF p_site IS NOT NULL AND p_site <> '' AND p_site <> 'all' THEN
    -- Extract first address segment before comma (e.g. 'BKC Plot C-26, Bandra East' from full address)
    v_site_clean := trim(split_part(p_site, ',', 1));
  END IF;

  SELECT
    COALESCE(SUM(COALESCE(running_hours, GREATEST(0, ROUND((COALESCE(end_meter, start_meter, 0) - COALESCE(start_meter, 0))::numeric, 1)))), 0),
    COALESCE(SUM(COALESCE(overtime_hours, 0)), 0),
    COALESCE(SUM(COALESCE(normal_working_hours, 8)), 0),
    COALESCE(COUNT(*) FILTER (WHERE is_breakdown = true), 0),
    COALESCE(COUNT(DISTINCT log_date), 0),
    COALESCE(COUNT(*), 0)
  INTO
    v_run_hours,
    v_ot_hours,
    v_working_hours,
    v_breakdowns,
    v_days,
    v_total_logs
  FROM public.machine_hour_logs
  WHERE (p_client_id IS NULL OR client_id = p_client_id)
    AND (p_machine_id IS NULL OR machine_id = p_machine_id)
    AND (p_operator_id IS NULL OR operator_id = p_operator_id)
    AND (
      p_site IS NULL 
      OR p_site = 'all' 
      OR location ILIKE '%' || p_site || '%'
      OR (v_site_clean IS NOT NULL AND location ILIKE '%' || v_site_clean || '%')
      OR (location IS NOT NULL AND location <> '' AND p_site ILIKE '%' || location || '%')
    )
    AND (p_start_date IS NULL OR log_date >= p_start_date)
    AND (p_end_date IS NULL OR log_date <= p_end_date);

  RETURN jsonb_build_object(
    'total_run_hours', ROUND(v_run_hours::numeric, 1),
    'total_ot_hours', ROUND(v_ot_hours::numeric, 1),
    'total_working_hours', ROUND(v_working_hours::numeric, 1),
    'total_breakdowns', v_breakdowns,
    'logged_days_count', v_days,
    'total_logs', v_total_logs
  );
END;
$function$;
