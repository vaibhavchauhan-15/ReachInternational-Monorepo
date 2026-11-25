-- ==============================================================================
-- Rollback: 239_approval_counts_service_role_identity.sql
-- Description: restores the pre-239 public.approval_counts() body. NOTE: this
--   re-introduces the regression where service-role callers receive zero counts.
--   Target: Development (vlmxciuogczumumrwyot)
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.approval_counts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT;
  v_caller_id UUID;
  v_total INT := 0;
  v_by_type JSONB := '{}'::jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    SELECT role INTO v_role FROM public.users WHERE id = v_caller_id;
  END IF;
  IF v_role IS NULL THEN
    v_role := public.current_user_role();
  END IF;

  -- Deny by default: non-approvers and unidentified callers receive zero counts
  IF v_role IS NULL
     OR (
       v_role NOT IN ('super_admin', 'admin', 'service_role', 'postgres')
       AND NOT EXISTS (
         SELECT 1 FROM public.approval_types t WHERE v_role = ANY(t.approver_roles)
       )
     ) THEN
    RETURN jsonb_build_object(
      'total', 0,
      'by_type', '{}'::jsonb
    );
  END IF;

  SELECT
    COALESCE(SUM(sub.cnt), 0),
    COALESCE(jsonb_object_agg(sub.type_key, sub.cnt), '{}'::jsonb)
  INTO v_total, v_by_type
  FROM (
    SELECT r.type_key, COUNT(*) AS cnt
    FROM public.approval_requests r
    WHERE r.status = 'pending'
      AND r.parent_id IS NULL
    GROUP BY r.type_key
  ) sub;

  RETURN jsonb_build_object(
    'total', v_total,
    'by_type', v_by_type
  );
END;
$function$;

COMMIT;

NOTIFY pgrst, 'reload schema';
