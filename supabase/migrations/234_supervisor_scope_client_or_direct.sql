-- ==============================================================================
-- Migration 234: Supervisor scope = client allocation OR direct assignment
-- ==============================================================================
-- 231/233 treated a client-linked machine as client-allocation-only, so a
-- supervisor explicitly set as current_supervisor_id/supervisor_ids on a
-- client machine still saw 0 rows for it. The matrix says "client-based or
-- direct", and the web directory, export and KPI RPC already use OR. This
-- migration makes the RLS helper and policy agree with them.
--
-- Rollback: supabase/rollbacks/234_rollback_supervisor_scope.sql
-- ==============================================================================

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

  IF v_role = 'supervisor' THEN
    RETURN (
      v_cur_sup = v_uid
      OR (v_sup_ids IS NOT NULL AND v_uid = ANY(v_sup_ids))
      OR (
        v_client_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.client_supervisors cs
          WHERE cs.client_id = v_client_id AND cs.supervisor_id = v_uid
        )
      )
    );
  END IF;

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

DROP POLICY IF EXISTS "machines_select_authorized" ON public.machines;
CREATE POLICY "machines_select_authorized" ON public.machines
  FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
    OR (
      (SELECT public.current_user_role()) = 'supervisor'
      AND (
        current_supervisor_id = auth.uid()
        OR auth.uid() = ANY (supervisor_ids)
        OR (
          client_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.client_supervisors cs
            WHERE cs.client_id = machines.client_id
              AND cs.supervisor_id = auth.uid()
          )
        )
      )
    )
    OR (
      (SELECT public.current_user_role()) = 'operator'
      AND public.check_user_can_access_machine(id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "machines_update_authorized" ON public.machines;
CREATE POLICY "machines_update_authorized" ON public.machines
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
    OR (
      (SELECT public.current_user_role()) = 'supervisor'
      AND (
        current_supervisor_id = auth.uid()
        OR auth.uid() = ANY (supervisor_ids)
        OR (
          client_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.client_supervisors cs
            WHERE cs.client_id = machines.client_id
              AND cs.supervisor_id = auth.uid()
          )
        )
      )
    )
    OR (
      (SELECT public.current_user_role()) = 'operator'
      AND public.check_user_can_access_machine(id, auth.uid())
    )
  )
  WITH CHECK (
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
    OR (
      (SELECT public.current_user_role()) = 'supervisor'
      AND (
        current_supervisor_id = auth.uid()
        OR auth.uid() = ANY (supervisor_ids)
        OR (
          client_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.client_supervisors cs
            WHERE cs.client_id = machines.client_id
              AND cs.supervisor_id = auth.uid()
          )
        )
      )
    )
    OR (
      (SELECT public.current_user_role()) = 'operator'
      AND public.check_user_can_access_machine(id, auth.uid())
    )
  );
