-- ==============================================================================
-- Migration 089: Machine Directory KPI Summary Scoping for Operators
-- Milestone: Support active operator_machine_assignments in get_machines_directory_summary
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_machines_directory_summary(
  p_supervisor_id uuid DEFAULT NULL,
  p_operator_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
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
    (p_supervisor_id IS NULL OR m.current_supervisor_id = p_supervisor_id OR m.supervisor_ids @> ARRAY[p_supervisor_id])
    AND
    (
      p_operator_id IS NULL
      OR m.current_operator_id = p_operator_id
      OR m.operator_ids @> ARRAY[p_operator_id]
      OR EXISTS (
        SELECT 1
        FROM public.operator_machine_assignments oma
        WHERE oma.machine_id = m.id
          AND oma.operator_id = p_operator_id
          AND oma.is_active = true
      )
    )
    AND
    (p_client_id IS NULL OR m.client_id = p_client_id);

  RETURN v_result;
END;
$$;

-- Grant execution permissions
REVOKE ALL ON FUNCTION public.get_machines_directory_summary(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_machines_directory_summary(uuid, uuid, uuid) TO authenticated, service_role;
