-- ==============================================================================
-- Migration: 239_approval_counts_service_role_identity.sql
-- Description:
--   Regression fix for 236. (Numbered 239 rather than 238 to leave 238 to
--   238_approvals_supervisor_metadata.sql. The two touch disjoint functions —
--   approval_counts vs approval_list — so replay order between them is irrelevant.)
--   public.approval_counts() denied every caller whose
--   role could not be resolved. The web/mobile data-access layer calls it through
--   the SERVICE ROLE, where auth.uid() is NULL, so the hardened guard returned
--   {total: 0} for administrators and the /approvals + /users badges went blank.
--   approval_list() already resolves a service-role identity; approval_counts()
--   now does the same. Unidentified application sessions still receive zero
--   counts (deny by default preserved).
--   Non-destructive: CREATE OR REPLACE only.
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
  IF v_caller_id IS NULL THEN
    -- Service-role / direct-database callers have no auth.uid(). Resolve a real
    -- administrator identity so the DAL (which uses the service role) still sees
    -- counts, while unidentified application sessions stay denied below.
    -- `current_user` is deliberately NOT used: it is always the function owner
    -- inside a SECURITY DEFINER body.
    IF COALESCE(current_setting('role', true), 'none') IN ('postgres', 'service_role', 'none') THEN
      SELECT id INTO v_caller_id
      FROM public.users
      WHERE role IN ('super_admin', 'admin') AND status = 'active'
      ORDER BY created_at
      LIMIT 1;
    END IF;
  END IF;

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
