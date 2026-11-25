-- ==============================================================================
-- Migration 231: Machines RBAC hardening + directory query cleanup (Web + Native)
-- ==============================================================================
-- Matrix enforced here (single source of intent: @reachinternational/permissions):
--   super_admin / admin / manager : full fleet
--   supervisor                    : supervised fleet only (client allocation or direct assignment)
--   hr                            : NO machine directory access
--   operator                      : actively assigned machine only (no unassigned fallback)
--
-- What this migration does:
--   1. Rewrites check_user_can_access_machine(uuid, uuid) to match the matrix.
--   2. Tightens machines SELECT/UPDATE RLS (drops the HR and unassigned-operator holes).
--   3. Aligns the operational-update trigger: supervisors may assign a client (confirmed
--      matrix cell), operators may not; static specs remain manager-only.
--   4. Adds a role check (ERRCODE 42501) to get_machines_directory_summary so it cannot be
--      used through PostgREST to read fleet KPIs outside the caller's scope.
--   5. Drops two provably duplicate indexes and adds the partial index used by the
--      operator RLS check.
--
-- Apply with: supabase db push (or the Management API query endpoint for Dev only).
-- Rollback: supabase/rollbacks/231_rollback_machines_rbac_and_query_hardening.sql
--           (kept outside migrations/ so it is never auto-applied in sequence)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Canonical per-user machine access predicate (RLS + trigger + server parity)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_user_can_access_machine(
  p_machine_id uuid,
  p_user_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role        TEXT;
  v_uid         UUID;
  v_client_id   UUID;
  v_cur_sup     UUID;
  v_sup_ids     UUID[];
  v_cur_op      UUID;
  v_op_ids      UUID[];
  v_today_ist   DATE;
BEGIN
  v_uid := COALESCE(p_user_id, auth.uid());
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Manager tier has monorepo-wide equipment visibility. HR is deliberately excluded.
  IF v_role IN ('super_admin', 'admin', 'manager') THEN
    RETURN TRUE;
  END IF;
  IF v_role <> 'supervisor' AND v_role <> 'operator' THEN
    RETURN FALSE;
  END IF;

  SELECT client_id, current_supervisor_id, supervisor_ids, current_operator_id, operator_ids
  INTO v_client_id, v_cur_sup, v_sup_ids, v_cur_op, v_op_ids
  FROM public.machines
  WHERE id = p_machine_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Supervisor: inherited through the client allocation, or legacy direct machine assignment.
  IF v_role = 'supervisor' THEN
    IF v_client_id IS NOT NULL THEN
      RETURN EXISTS (
        SELECT 1 FROM public.client_supervisors cs
        WHERE cs.client_id = v_client_id AND cs.supervisor_id = v_uid
      );
    END IF;
    RETURN v_cur_sup = v_uid OR (v_sup_ids IS NOT NULL AND v_uid = ANY(v_sup_ids));
  END IF;

  -- Operator: active effective-dated assignment today, or live legacy machine assignment.
  v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  IF EXISTS (
    SELECT 1
    FROM public.operator_machine_assignments oma
    WHERE oma.machine_id = p_machine_id
      AND oma.operator_id = v_uid
      AND oma.valid_from <= v_today_ist
      AND (oma.valid_to IS NULL OR oma.valid_to >= v_today_ist)
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN v_cur_op = v_uid OR (v_op_ids IS NOT NULL AND v_uid = ANY(v_op_ids));
END;
$$;

-- The single-argument wrapper used by existing policies.
CREATE OR REPLACE FUNCTION public.check_user_can_access_machine(p_machine_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.check_user_can_access_machine(p_machine_id, auth.uid());
$$;

-- Existing EXECUTE grants are preserved (signatures unchanged).

-- ------------------------------------------------------------------------------
-- 2. RLS: SELECT / UPDATE aligned with the matrix
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "machines_select_authorized" ON public.machines;
CREATE POLICY "machines_select_authorized" ON public.machines
  FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
    OR public.check_user_can_access_machine(id, auth.uid())
  );

DROP POLICY IF EXISTS "machines_update_authorized" ON public.machines;
CREATE POLICY "machines_update_authorized" ON public.machines
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
    OR (
      (SELECT public.current_user_role()) IN ('supervisor', 'operator')
      AND public.check_user_can_access_machine(id, auth.uid())
    )
  )
  WITH CHECK (
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
    OR (
      (SELECT public.current_user_role()) IN ('supervisor', 'operator')
      AND public.check_user_can_access_machine(id, auth.uid())
    )
  );

-- INSERT/DELETE stay manager-tier only (migration 040), restated for clarity.
DROP POLICY IF EXISTS "machines_insert_authorized" ON public.machines;
CREATE POLICY "machines_insert_authorized" ON public.machines
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager'));

DROP POLICY IF EXISTS "machines_delete_authorized" ON public.machines;
CREATE POLICY "machines_delete_authorized" ON public.machines
  FOR DELETE TO authenticated
  USING ((SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager'));

-- ------------------------------------------------------------------------------
-- 3. Operational update trigger
--    - supervisor: may change operational fields INCLUDING client/site (confirmed cell)
--    - operator: may not change specs, client, personnel, supervisors, or rental status;
--      hour_meter/health_status remain writable because submit_hour_log() writes them
--      through the SECURITY DEFINER logging RPC.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_supervisor_machine_update_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := public.current_user_role();
BEGIN
  -- Static specification + supervisor assignment immutability (supervisor and operator).
  IF v_role IN ('supervisor', 'operator') THEN
    IF OLD.machine_id IS DISTINCT FROM NEW.machine_id THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Machine ID.' USING ERRCODE = '42501';
    END IF;
    IF OLD.model IS DISTINCT FROM NEW.model THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Machine Model.' USING ERRCODE = '42501';
    END IF;
    IF OLD.serial_number IS DISTINCT FROM NEW.serial_number THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Machine Serial Number.' USING ERRCODE = '42501';
    END IF;
    IF OLD.year_of_mfg IS DISTINCT FROM NEW.year_of_mfg THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Year of Manufacture.' USING ERRCODE = '42501';
    END IF;
    IF OLD.manufacturer IS DISTINCT FROM NEW.manufacturer THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Manufacturer.' USING ERRCODE = '42501';
    END IF;
    IF OLD.current_supervisor_id IS DISTINCT FROM NEW.current_supervisor_id
       OR OLD.supervisor_ids IS DISTINCT FROM NEW.supervisor_ids THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change or unassign Machine Supervisors.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Operator only: no client/rental/personnel mutations.
  IF v_role = 'operator' THEN
    IF OLD.client_id IS DISTINCT FROM NEW.client_id OR OLD.site_id IS DISTINCT FROM NEW.site_id THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Machine Client Assignment.' USING ERRCODE = '42501';
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Machine Rental Status.' USING ERRCODE = '42501';
    END IF;
    IF OLD.operator_ids IS DISTINCT FROM NEW.operator_ids THEN
      RAISE EXCEPTION 'Unauthorized: Operators cannot modify Machine Operator assignments.' USING ERRCODE = '42501';
    END IF;
    IF OLD.current_operator_id IS DISTINCT FROM NEW.current_operator_id
       AND (
         NEW.current_operator_id IS DISTINCT FROM auth.uid()
         OR NOT public.check_user_can_access_machine(NEW.id, auth.uid())
       ) THEN
      RAISE EXCEPTION 'Unauthorized: Operators cannot modify Machine Operator assignments.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Directory KPI RPC: scope guard (42501) instead of trusting caller arguments.
--    service_role is used by the cached server DAL and is trusted.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_machines_directory_summary(
  p_supervisor_id uuid DEFAULT NULL::uuid,
  p_operator_id uuid DEFAULT NULL::uuid,
  p_client_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_uid  UUID := auth.uid();
  v_result jsonb;
BEGIN
  -- Trusted server-side cache client (service role JWT).
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT role INTO v_role FROM public.users WHERE id = v_uid;
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: unknown role.' USING ERRCODE = '42501';
    END IF;

    IF v_role IN ('super_admin', 'admin', 'manager') THEN
      NULL; -- full fleet
    ELSIF v_role = 'supervisor' THEN
      IF p_supervisor_id IS DISTINCT FROM v_uid THEN
        RAISE EXCEPTION 'Unauthorized: supervisors may only read their own supervised KPIs.'
          USING ERRCODE = '42501';
      END IF;
    ELSIF v_role = 'operator' THEN
      IF p_operator_id IS DISTINCT FROM v_uid THEN
        RAISE EXCEPTION 'Unauthorized: operators may only read their own assigned-machine KPIs.'
          USING ERRCODE = '42501';
      END IF;
    ELSE
      RAISE EXCEPTION 'Unauthorized: role % has no machine directory access.', v_role
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*)::bigint,
    'available', COUNT(*) FILTER (WHERE status = 'available')::bigint,
    'rented', COUNT(*) FILTER (WHERE status = 'rented')::bigint,
    'breakdown', COUNT(*) FILTER (WHERE health_status = 'breakdown')::bigint,
    'maintenance', COUNT(*) FILTER (WHERE health_status IN ('maintenance', 'under_maintenance'))::bigint,
    'spare', COUNT(*) FILTER (WHERE health_status = 'spare')::bigint,
    'active', COUNT(*) FILTER (WHERE health_status = 'active')::bigint
  )
  INTO v_result
  FROM public.machines m
  WHERE
    (
      p_supervisor_id IS NULL
      OR m.current_supervisor_id = p_supervisor_id
      OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_supervisor_id])
      OR (
        m.client_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.client_supervisors cs
          WHERE cs.client_id = m.client_id AND cs.supervisor_id = p_supervisor_id
        )
      )
    )
    AND
    (
      p_operator_id IS NULL
      OR m.current_operator_id = p_operator_id
      OR (m.operator_ids IS NOT NULL AND m.operator_ids @> ARRAY[p_operator_id])
      OR EXISTS (
        SELECT 1
        FROM public.operator_machine_assignments oma
        WHERE oma.machine_id = m.id
          AND oma.operator_id = p_operator_id
          AND oma.valid_from <= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
          AND (oma.valid_to IS NULL OR oma.valid_to >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date)
      )
    )
    AND
    (p_client_id IS NULL OR m.client_id = p_client_id);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_machines_directory_summary(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_machines_directory_summary(uuid, uuid, uuid) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. Index hygiene
--    - adds the (machine_id, operator_id) partial index used by the operator RLS check
--    - drops two exact duplicate indexes measured with pg_stat_user_indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_oma_machine_operator_active
  ON public.operator_machine_assignments (machine_id, operator_id)
  WHERE is_active = true;

DROP INDEX IF EXISTS public.idx_mhl_operator_date;          -- duplicate of idx_mhl_operator_log_date
DROP INDEX IF EXISTS public.idx_machines_machine_id_unique; -- duplicate of machines_machine_id_key unique constraint

ANALYZE public.machines;
ANALYZE public.operator_machine_assignments;
ANALYZE public.machine_hour_logs;

-- ------------------------------------------------------------------------------
-- 6. Bounded HMR aggregate for the machine detail tab
--    Replaces the DAL's "download every log row to sum hours" metadata query with
--    one indexed aggregate. Scope-checked for authenticated callers; callers with
--    no access get NULL (the DAL translates this to an empty summary).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_machine_hour_log_summary(p_machine_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR NOT public.check_user_can_access_machine(p_machine_id) THEN
      RETURN NULL;
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'total_hours', COALESCE(ROUND(SUM(mhl.running_hours)::numeric, 1), 0),
    'operators', COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object('id', mhl.operator_id, 'name', u.full_name))
        FILTER (WHERE mhl.operator_id IS NOT NULL AND u.full_name IS NOT NULL),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM public.machine_hour_logs mhl
  LEFT JOIN public.users u ON u.id = mhl.operator_id
  WHERE mhl.machine_id = p_machine_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_machine_hour_log_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_machine_hour_log_summary(uuid) TO authenticated, service_role;
