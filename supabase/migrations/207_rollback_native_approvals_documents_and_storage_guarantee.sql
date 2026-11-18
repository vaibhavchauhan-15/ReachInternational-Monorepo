-- ==============================================================================
-- Rollback Migration 204: Native Approvals Documents, Rich Metadata & Storage Policy Guarantee
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- ==============================================================================

-- 1. Drop doc_staging storage policy
DROP POLICY IF EXISTS "Admins and HR can read doc_staging" ON storage.objects;

-- 2. Restore previous approval_list function signature from Migration 201
DROP FUNCTION IF EXISTS public.approval_list(TEXT, TEXT, TIMESTAMPTZ, UUID, INT);

CREATE OR REPLACE FUNCTION public.approval_list(
  p_status TEXT DEFAULT 'pending',
  p_type_key TEXT DEFAULT NULL,
  p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  type_key TEXT,
  type_label TEXT,
  subject_type TEXT,
  subject_id UUID,
  subject_label TEXT,
  requested_by UUID,
  requester_name TEXT,
  status public.approval_status,
  summary TEXT,
  priority SMALLINT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  version INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_limit INT;
BEGIN
  v_role := public.current_user_role();
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);

  RETURN QUERY
  SELECT
    r.id,
    r.type_key,
    t.label AS type_label,
    r.subject_type,
    r.subject_id,
    r.subject_label,
    r.requested_by,
    u.full_name AS requester_name,
    r.status,
    r.summary,
    t.priority,
    r.created_at,
    r.expires_at,
    r.version
  FROM public.approval_requests r
  JOIN public.approval_types t ON t.key = r.type_key
  LEFT JOIN public.users u ON u.id = r.requested_by
  WHERE (p_status = 'all' OR r.status = p_status::public.approval_status)
    AND (p_type_key IS NULL OR r.type_key = p_type_key)
    AND (
      v_role IN ('super_admin', 'admin', 'hr', 'service_role', 'postgres')
      OR v_role IS NULL
      OR v_role = ANY(t.approver_roles)
      OR r.requested_by = auth.uid()
      OR r.subject_id = auth.uid()
    )
    AND (
      p_cursor_created_at IS NULL
      OR (r.created_at, r.id) < (p_cursor_created_at, p_cursor_id)
    )
  ORDER BY r.created_at DESC, r.id DESC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approval_list(TEXT, TEXT, TIMESTAMPTZ, UUID, INT) TO authenticated;
