-- ==============================================================================
-- Rollback for Migration 231: Machines RBAC + query hardening
-- ==============================================================================
-- Restores the pre-231 (migration 188/183 era) policies and helper function shape.
-- The duplicate indexes are recreated; the added partial index is removed.
-- Safe to run once. Does not touch machine data.
-- ==============================================================================

-- 1. Restore the previous access predicate (HR allowed, unassigned-operator fallback).
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
  v_role TEXT;
  v_uid UUID;
  v_client_id UUID;
  v_cur_sup UUID;
  v_sup_ids UUID[];
  v_cur_op UUID;
  v_op_ids UUID[];
  v_today_ist DATE;
BEGIN
  v_uid := COALESCE(p_user_id, auth.uid());
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;

  IF v_role IN ('super_admin', 'admin', 'manager', 'hr') THEN
    RETURN TRUE;
  END IF;

  SELECT client_id, current_supervisor_id, supervisor_ids, current_operator_id, operator_ids
  INTO v_client_id, v_cur_sup, v_sup_ids, v_cur_op, v_op_ids
  FROM public.machines
  WHERE id = p_machine_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_role = 'supervisor' THEN
    IF v_client_id IS NOT NULL THEN
      RETURN EXISTS (
        SELECT 1 FROM public.client_supervisors cs
        WHERE cs.client_id = v_client_id AND cs.supervisor_id = v_uid
      );
    ELSE
      IF v_cur_sup = v_uid OR (v_sup_ids IS NOT NULL AND v_uid = ANY(v_sup_ids)) THEN
        RETURN TRUE;
      END IF;
      RETURN FALSE;
    END IF;
  END IF;

  IF v_role = 'operator' THEN
    v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
    IF EXISTS (
      SELECT 1 FROM public.operator_machine_assignments oma
      WHERE oma.machine_id = p_machine_id
        AND oma.operator_id = v_uid
        AND (
          oma.is_active = true
          OR oma.valid_to IS NULL
          OR oma.valid_to >= (v_today_ist - 7)
        )
    ) THEN
      RETURN TRUE;
    END IF;

    IF v_cur_op = v_uid OR (v_op_ids IS NOT NULL AND v_uid = ANY(v_op_ids)) THEN
      RETURN TRUE;
    END IF;

    IF (v_op_ids IS NULL OR cardinality(v_op_ids) = 0) AND v_cur_op IS NULL THEN
      RETURN TRUE;
    END IF;

    RETURN FALSE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 2. Restore previous policies.
DROP POLICY IF EXISTS "machines_select_authorized" ON public.machines;
CREATE POLICY "machines_select_authorized" ON public.machines
  FOR SELECT TO authenticated
  USING (
    ((SELECT public.current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager', 'hr']))
    OR public.check_user_can_access_machine(id, auth.uid())
  );

DROP POLICY IF EXISTS "machines_update_authorized" ON public.machines;
CREATE POLICY "machines_update_authorized" ON public.machines
  FOR UPDATE TO authenticated
  USING (
    ((SELECT public.current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager', 'supervisor']))
    OR (
      (SELECT public.current_user_role()) = 'operator'
      AND (
        public.check_user_can_access_machine(id, auth.uid())
        OR (auth.uid() = ANY (operator_ids))
        OR current_operator_id = auth.uid()
        OR current_operator_id IS NULL
        OR operator_ids = '{}'::uuid[]
      )
    )
  )
  WITH CHECK (true);

-- 3. Restore the previous operational trigger (supervisors cannot change client; operator status allowed).
CREATE OR REPLACE FUNCTION public.enforce_supervisor_machine_update_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (public.current_user_role() IN ('supervisor', 'operator')) THEN
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
    IF OLD.client_id IS DISTINCT FROM NEW.client_id THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Machine Client Assignment.' USING ERRCODE = '42501';
    END IF;
    IF OLD.current_supervisor_id IS DISTINCT FROM NEW.current_supervisor_id
       OR OLD.supervisor_ids IS DISTINCT FROM NEW.supervisor_ids THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change or unassign Machine Supervisors.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF (public.current_user_role() = 'operator') THEN
    IF OLD.operator_ids IS DISTINCT FROM NEW.operator_ids THEN
      RAISE EXCEPTION 'Unauthorized: Operators cannot modify Machine Operator assignments.' USING ERRCODE = '42501';
    END IF;
    IF OLD.current_operator_id IS DISTINCT FROM NEW.current_operator_id THEN
      IF (NEW.current_operator_id IS DISTINCT FROM auth.uid()
          OR NOT public.check_user_can_access_machine(NEW.id, auth.uid())) THEN
        RAISE EXCEPTION 'Unauthorized: Operators cannot modify Machine Operator assignments.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Restore the previous KPI RPC (no role guard).
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
  v_result jsonb;
BEGIN
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
        SELECT 1 FROM public.operator_machine_assignments oma
        WHERE oma.machine_id = m.id
          AND oma.operator_id = p_operator_id
          AND oma.is_active = true
      )
    )
    AND (p_client_id IS NULL OR m.client_id = p_client_id);

  RETURN v_result;
END;
$$;

-- 5. Restore indexes.
DROP INDEX IF EXISTS public.idx_oma_machine_operator_active;
CREATE INDEX IF NOT EXISTS idx_mhl_operator_date
  ON public.machine_hour_logs USING btree (operator_id, log_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_machines_machine_id_unique
  ON public.machines USING btree (machine_id);

-- 6. Remove the bounded HMR aggregate added by migration 231.
DROP FUNCTION IF EXISTS public.get_machine_hour_log_summary(uuid);
