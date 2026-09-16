-- ==============================================================================
-- Migration 068: Machine Directory KPI Client Scoping & Maintenance Status Harmonization
-- Milestone M9: Enhance public.get_machines_directory_summary() with p_client_id
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_machines_directory_summary(
  p_supervisor_id uuid DEFAULT NULL,
  p_operator_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  FROM public.machines
  WHERE
    (p_supervisor_id IS NULL OR current_supervisor_id = p_supervisor_id OR supervisor_ids @> ARRAY[p_supervisor_id])
    AND
    (p_operator_id IS NULL OR current_operator_id = p_operator_id OR operator_ids @> ARRAY[p_operator_id])
    AND
    (p_client_id IS NULL OR client_id = p_client_id);

  RETURN v_result;
END;
$$;

-- Grant execution permissions
REVOKE ALL ON FUNCTION public.get_machines_directory_summary(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_machines_directory_summary(uuid, uuid, uuid) TO authenticated, service_role;
